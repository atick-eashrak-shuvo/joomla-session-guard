<?php

/**
 * @package     Custom.Plugin
 * @subpackage  System.Sessionguard
 *
 * @copyright   Copyright (C) 2026. All rights reserved.
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

namespace Custom\Plugin\System\Sessionguard\Extension;

\defined('_JEXEC') or die;

use Joomla\CMS\HTML\HTMLHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Version;
use Joomla\Event\Event;
use Joomla\Event\SubscriberInterface;

/**
 * Session Guard System Plugin.
 *
 * Warns users before their Joomla session expires and provides optional
 * session renewal via AJAX — for both frontend and backend contexts.
 *
 * @since  1.0.0
 */
final class SessionGuard extends CMSPlugin implements SubscriberInterface
{
    /**
     * Returns an array of events this subscriber listens to.
     *
     * @return  array<string, string>
     * @since   1.0.0
     */
    public static function getSubscribedEvents(): array
    {
        // Use Joomla's version to decide which onAjax signature to use.
        // Joomla 4.x/5.x: legacy trigger without event object.
        // Joomla 6.x: dispatches a typed AjaxEvent into the handler.
        $major = \defined('JVERSION') ? (int) JVERSION[0] : (int) Version::MAJOR_VERSION;

        if ($major >= 6) {
            return [
                'onBeforeRender'     => 'injectAssets',
                'onAjaxSessionguard' => 'handleAjaxRenewalV6',
            ];
        }

        return [
            'onBeforeRender'     => 'injectAssets',
            'onAjaxSessionguard' => 'handleAjaxRenewalLegacy',
        ];
    }

    /**
     * Handles the AJAX session renewal request (Joomla 4.x / 5.x legacy signature).
     *
     * @return  void
     * @since   1.0.0
     */
    public function handleAjaxRenewalLegacy(): void
    {
        $this->processAjaxRenewal();
    }

    /**
     * Handles the AJAX session renewal request (Joomla 6.x event-dispatch signature).
     *
     * IMPORTANT: Do not typehint the argument as AjaxEvent because Joomla 4 does not
     * have that class; we want this file to be parseable on Joomla 4/5 as well.
     *
     * @param   mixed  $event  The event instance (unused; output is sent directly).
     *
     * @return  void
     * @since   1.0.0
     */
    public function handleAjaxRenewalV6($event): void
    {
        $this->processAjaxRenewal();
    }

    /**
     * Shared AJAX session renewal logic for all Joomla versions.
     *
     * @return  void
     * @since   1.0.0
     */
    private function processAjaxRenewal(): void
    {
        $app = $this->getApplication();

        $app->setHeader('Content-Type', 'application/json; charset=utf-8');

        // Validate the Joomla security token (present in the URL as {token}=1)
        if (!Session::checkToken('get') && !Session::checkToken('post')) {
            $this->sendJson(['status' => 'error', 'message' => 'Invalid security token.']);
            return;
        }

        // Only serve authenticated users
        $user = $app->getIdentity();

        if (!$user || $user->guest) {
            $this->sendJson(['status' => 'expired', 'message' => 'Session has expired.']);
            return;
        }

        // Touch the session to reset its TTL server-side
        $app->getSession()->set('sessionguard.last_renewed', time());

        $lifetimeMinutes = (int) $app->get('lifetime', 15);
        $newExpiry       = time() + ($lifetimeMinutes * 60);

        $this->sendJson([
            'status'   => 'renewed',
            'expiry'   => $newExpiry,
            'lifetime' => $lifetimeMinutes,
        ]);
    }

    /**
     * Injects the session guard configuration and assets before page render.
     *
     * @param   Event  $event  The event object.
     *
     * @return  void
     * @since   1.0.0
     */
    public function injectAssets(Event $event): void
    {
        $app = $this->getApplication();

        // Only act on HTML document responses
        $document = $app->getDocument();

        if ($document->getType() !== 'html') {
            return;
        }

        $isAdmin = $app->isClient('administrator');

        // Respect per-context enable/disable settings
        if ($isAdmin && !(int) $this->params->get('enable_backend', 1)) {
            return;
        }

        if (!$isAdmin && !(int) $this->params->get('enable_frontend', 1)) {
            return;
        }

        // Only inject for authenticated users
        $user = $app->getIdentity();

        if (!$user || $user->guest) {
            return;
        }

        $this->loadLanguage();

        // Read Joomla Global Configuration session lifetime (minutes)
        $lifetimeMinutes = (int) $app->get('lifetime', 15);

        // Server-side expiry timestamp (seconds since epoch)
        $expiryTime = time() + ($lifetimeMinutes * 60);

        // Plugin parameters
        $warningTimeMinutes = max(1, (int) $this->params->get('warning_time', 1));
        $uiType             = $this->params->get('ui_type', 'modal');
        $autoRenew          = (bool) (int) $this->params->get('auto_renew', 0);
        $autoRenewBefore    = max(5, (int) $this->params->get('auto_renew_before', 30));
        $crossTab           = (bool) (int) $this->params->get('cross_tab', 1);
        $customMessage      = trim((string) $this->params->get('warning_message', ''));

        $warningMessage = $customMessage !== ''
            ? $customMessage
            : Text::_('PLG_SYSTEM_SESSIONGUARD_DEFAULT_WARNING_MESSAGE');

        // Security token embedded in the AJAX URL
        $token   = Session::getFormToken();
        $ajaxUrl = Uri::base() . 'index.php?option=com_ajax&plugin=sessionguard&group=system&format=raw&' . $token . '=1';

        // Config object passed to JavaScript
        $jsConfig = [
            'expiryTime'      => $expiryTime,
            'warningTime'     => $warningTimeMinutes * 60,
            'uiType'          => $uiType,
            'autoRenew'       => $autoRenew,
            'autoRenewBefore' => $autoRenewBefore,
            'crossTab'        => $crossTab,
            'isAdmin'         => $isAdmin,
            'ajaxUrl'         => $ajaxUrl,
            'messages'        => [
                'title'        => Text::_('PLG_SYSTEM_SESSIONGUARD_TITLE'),
                'expiredTitle' => Text::_('PLG_SYSTEM_SESSIONGUARD_EXPIRED_TITLE'),
                'warning'      => $warningMessage,
                'extending'    => Text::_('PLG_SYSTEM_SESSIONGUARD_MSG_EXTENDING'),
                'extended'     => Text::_('PLG_SYSTEM_SESSIONGUARD_MSG_EXTENDED'),
                'expired'      => Text::_('PLG_SYSTEM_SESSIONGUARD_MSG_EXPIRED'),
                'extendBtn'    => Text::_('PLG_SYSTEM_SESSIONGUARD_BTN_EXTEND'),
                'dismissBtn'   => Text::_('PLG_SYSTEM_SESSIONGUARD_BTN_DISMISS'),
                'reloadBtn'    => Text::_('PLG_SYSTEM_SESSIONGUARD_BTN_RELOAD'),
                'countdown'    => Text::_('PLG_SYSTEM_SESSIONGUARD_MSG_COUNTDOWN'),
            ],
        ];

        $document->addScriptDeclaration(
            'window.SessionGuard = ' . json_encode($jsConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';'
        );

        // Load assets directly from the Joomla media directory where the
        // installer deploys them: media/plg_system_sessionguard/...
        $base = rtrim(Uri::root(true), '/') . '/media/plg_system_sessionguard/';

        $document->addStyleSheet(
            $base . 'css/sessionguard.css',
            ['version' => 'auto']
        );

        $document->addScript(
            $base . 'js/sessionguard.js',
            ['version' => 'auto'],
            ['defer' => true]
        );
    }

    /**
     * Encodes and sends a JSON response, then closes the application.
     *
     * @param   array<string, mixed>  $data  Response data.
     *
     * @return  void
     * @since   1.0.0
     */
    private function sendJson(array $data): void
    {
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        $this->getApplication()->close();
    }
}

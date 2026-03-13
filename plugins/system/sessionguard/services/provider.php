<?php

/**
 * @package     Custom.Plugin
 * @subpackage  System.Sessionguard
 *
 * @copyright   Copyright (C) 2026. All rights reserved.
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

\defined('_JEXEC') or die;

use Custom\Plugin\System\Sessionguard\Extension\SessionGuard;
use Joomla\CMS\Extension\PluginInterface;
use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;
use Joomla\Event\DispatcherInterface;

return new class () implements ServiceProviderInterface {
    /**
     * Registers the service provider with a DI container.
     *
     * @param   Container  $container  The DI container.
     *
     * @return  void
     * @since   1.0.0
     */
    public function register(Container $container): void
    {
        $container->set(
            PluginInterface::class,
            static function (Container $container): SessionGuard {
                $plugin     = PluginHelper::getPlugin('system', 'sessionguard');
                $dispatcher = $container->get(DispatcherInterface::class);

                // Joomla 4/5/6 CMSPlugin expects the dispatcher as the first (subject) argument.
                // In Joomla 4 the $subject argument is passed by reference, so it must be a variable.
                $instance = new SessionGuard($dispatcher, (array) $plugin);
                $instance->setDispatcher($dispatcher);
                $instance->setApplication(Factory::getApplication());

                return $instance;
            }
        );
    }
};

import { CubeIcon, InboxIcon, Cog6ToothIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';
import InstallProgress from '../components/InstallProgress';
import { useUpdateStatus } from '../hooks/useUpdateStatus';

const Sidebar = () => {
    const update = useUpdateStatus();
    const updateText = update?.state === 'available' ? `Runway ${update.version} is available`
        : update?.state === 'downloading' ? `Downloading Runway ${update.version}: ${update.percent ?? 0}%`
        : update?.state === 'downloaded' ? `Runway ${update.version} is ready to install`
        : null;

    const menuItems = [
        { id: 'projects', label: 'Projects', to: '/', Icon: CubeIcon },
        { id: 'editors', label: 'Editors', to: '/editors', Icon: InboxIcon },
        { id: 'install', label: 'Install', to: '/install', Icon: ArrowDownTrayIcon },
        { id: 'settings', label: 'Settings', to: '/settings', Icon: Cog6ToothIcon },
    ];

    return (
        <div className="fixed h-full w-48 bg-neutral-800 border-r border-neutral-700 text-white p-4 z-50 flex flex-col justify-between">
            <ul>
                {menuItems.map(({ id, label, to, Icon }) => (
                    <li key={id} className="mb-4 flex items-center rounded-md cursor-pointer">
                        <NavLink
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center w-full text-md p-2 rounded-md ${isActive ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'
                                }`
                            }
                        >
                            <Icon className="h-6 w-6 mr-3" />
                            {label}
                        </NavLink>
                    </li>
                ))}
            </ul>
            <div className="flex flex-col gap-2">
                {updateText && (
                    <NavLink to="/settings" className="p-3 rounded-md bg-neutral-900 border border-blue-800 text-xs text-blue-300 hover:text-blue-200">
                        {updateText}
                    </NavLink>
                )}
                <InstallProgress />
            </div>
        </div>
    );
};

export default Sidebar;
import { CubeIcon, InboxIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {

    const menuItems = [
        { id: 'projects', label: 'Projects', to: '/', Icon: CubeIcon },
        { id: 'editors', label: 'Editors', to: '/editors', Icon: InboxIcon },
        { id: 'settings', label: 'Settings', to: '/settings', Icon: Cog6ToothIcon },
    ];

    return (
        <div className="fixed h-full w-48 bg-neutral-800 border-r border-neutral-700 text-white p-4 z-50">
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
        </div>
    );
};

export default Sidebar;
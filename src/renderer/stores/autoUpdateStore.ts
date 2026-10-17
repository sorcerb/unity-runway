import Store from 'electron-store';

const store = new Store<{ AutoUpdate: boolean }>({ defaults: { AutoUpdate: true } });

export const getAutoUpdate = (): boolean => store.get('AutoUpdate', true);

export const setAutoUpdate = (enabled: boolean): void => {
    store.set('AutoUpdate', enabled);
};

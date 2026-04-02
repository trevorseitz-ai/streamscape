import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reeldive_providers';
const INITIALIZED_KEY = 'reeldive_providers_initialized';

const LEGACY_STORAGE_KEY = 'streamscape_provider_ids';
const LEGACY_INITIALIZED_KEY = 'streamscape_providers_initialized';

const DEFAULT_FREE_IDS = [73, 300, 283, 207]; // Tubi, Pluto TV, Freevee, Roku Channel

async function migrateProvidersFromLegacyIfNeeded(): Promise<void> {
  const newInit = await AsyncStorage.getItem(INITIALIZED_KEY);
  const newIds = await AsyncStorage.getItem(STORAGE_KEY);
  if (newInit !== null || newIds !== null) {
    if (newIds !== null && newInit === null) {
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
    }
    const legacyIds = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    const legacyInit = await AsyncStorage.getItem(LEGACY_INITIALIZED_KEY);
    if (legacyIds !== null || legacyInit !== null) {
      await AsyncStorage.multiRemove([
        LEGACY_STORAGE_KEY,
        LEGACY_INITIALIZED_KEY,
      ]);
    }
    return;
  }

  const legacyIds = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  const legacyInit = await AsyncStorage.getItem(LEGACY_INITIALIZED_KEY);
  if (legacyIds === null && legacyInit === null) {
    return;
  }

  let ids: number[] = [];
  if (legacyIds) {
    try {
      const parsed = JSON.parse(legacyIds);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      /* ignore */
    }
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(INITIALIZED_KEY, legacyInit ?? 'true');
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_INITIALIZED_KEY);
}

export async function getSavedProviderIds(): Promise<number[]> {
  try {
    await migrateProvidersFromLegacyIfNeeded();

    const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
    if (!initialized) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FREE_IDS));
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
      return DEFAULT_FREE_IDS;
    }
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveProviderIds(ids: number[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  const init = await AsyncStorage.getItem(INITIALIZED_KEY);
  if (!init) {
    await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

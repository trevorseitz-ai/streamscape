import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'streamscape_provider_ids';
const INITIALIZED_KEY = 'streamscape_providers_initialized';

const DEFAULT_FREE_IDS = [73, 300, 283, 207]; // Tubi, Pluto TV, Freevee, Roku Channel

export async function getSavedProviderIds(): Promise<number[]> {
  try {
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
}

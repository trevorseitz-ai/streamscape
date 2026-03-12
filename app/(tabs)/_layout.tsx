import { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { CountrySelector } from '../../components/CountrySelector';

function getTabIcon(routeName: string, focused: boolean) {
  const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
    index: { active: 'home', inactive: 'home-outline' },
    discover: { active: 'compass', inactive: 'compass-outline' },
    watchlist: { active: 'list', inactive: 'list-outline' },
    settings: { active: 'settings', inactive: 'settings-outline' },
  };
  const icons = iconMap[routeName];
  const name = icons ? (focused ? icons.active : icons.inactive) : 'ellipse-outline';
  return name;
}

export default function TabLayout() {
  const router = useRouter();
  const [session, setSession] = useState<{
    user: { id: string; email?: string };
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: '#0f0f0f',
          borderTopColor: '#2d2d2d',
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={getTabIcon(route.name, focused)}
            size={size}
            color={color}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerShown: true,
        headerStyle: { backgroundColor: '#0f0f0f' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={styles.headerRight}>
            <CountrySelector />
            {session ? (
              <Pressable
                style={styles.headerButton}
                onPress={() => supabase.auth.signOut()}
              >
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={styles.logoutText}>Log Out</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.headerButton}
                onPress={() => router.push('/login')}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color="#6366f1"
                />
                <Text style={styles.loginText}>Sign In</Text>
              </Pressable>
            )}
          </View>
        ),
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover' }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: 'My Watchlist' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
      <Tabs.Screen
        name="movie"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  loginText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

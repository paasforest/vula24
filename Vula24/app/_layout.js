import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              backgroundColor: '#111111',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 18,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              Something went wrong
            </Text>
            <Text
              style={{
                color: '#888',
                fontSize: 14,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Please close and reopen the app
            </Text>
            <TouchableOpacity
              onPress={() =>
                this.setState({
                  hasError: false,
                  error: null,
                })
              }
              style={{
                backgroundColor: '#D4A017',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: '#000',
                  fontWeight: 'bold',
                }}
              >
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#111111' },
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

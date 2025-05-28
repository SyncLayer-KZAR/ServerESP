import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    try {
      // Get stored E_S from SecureStorage
      const e_s = await SecureStore.getItemAsync('E_S');
      if (!e_s) {
        Alert.alert('Error', 'No E_S found in Secure Storage. Please register first.');
        return;
      }

      const response = await fetch('http://192.168.2.167:5050/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          E_S: e_s,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle backend errors with proper messages
        const error = data.error || 'Login failed';
        Alert.alert('Login Failed', error);
        return;
      }

      // Login success — store new E_S in SecureStorage
      await SecureStore.setItemAsync('E_S', data.E_S);
      Alert.alert('Success', 'You are successfully logged in');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', 'Unexpected error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
});
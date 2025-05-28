import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function HomeScreen({ navigation }) {
  const [storedData, setStoredData] = useState('');

  const handleCheckDB = async () => {
    try {
      const e_s = await SecureStore.getItemAsync('E_S');
      if (e_s) {
        setStoredData(e_s); // Set stored data to E_S
      } else {
        setStoredData('Nothing stored in Secure Storage'); // Set default message
      }
    } catch (error) {
      console.error('Error fetching E_S:', error);
      setStoredData('Error fetching data');
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register'); // Navigate to Register screen
  };

  const handleLogin = () => {
    navigation.navigate('Login'); // Navigate to Login screen
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Home Screen</Text>

      {/* Register and Login buttons */}
      <Button title="Register" onPress={handleRegister} />
      <Button title="Login" onPress={handleLogin} />

      {/* Check DB button */}
      <Button title="Check DB" onPress={handleCheckDB} />

      {/* Display stored E_S or default message */}
      <View style={styles.resultContainer}>
        <Text style={styles.resultLabel}>Stored E_S:</Text>
        <Text>{storedData || 'Click Check DB to load data'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 24,
    marginBottom: 20,
  },
  resultContainer: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    width: '100%',
  },
  resultLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
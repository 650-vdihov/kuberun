import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Camera, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Gender = 'male' | 'female' | 'other';

interface ProfileData {
  name: string;
  image?: string;
  height: string; // in cm
  weight: string; // in kg
  gender: Gender;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  // TODO: Load from actual user state/API
  const [profile, setProfile] = useState<ProfileData>({
    name: 'John Doe',
    image: 'https://i.pravatar.cc/150?img=1',
    height: '180',
    weight: '75',
    gender: 'male',
  });

  const [isEditing, setIsEditing] = useState(false);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfile((prev) => ({ ...prev, image: result.assets[0].uri }));
    }
  };

  const handleSave = () => {
    // TODO: Save to API/state
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity onPress={isEditing ? handleSave : () => setIsEditing(true)}>
          <Text style={[styles.editButton, { color: colors.tint }]}>
            {isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={isEditing ? handlePickImage : undefined} activeOpacity={isEditing ? 0.7 : 1}>
            <View style={[styles.imageContainer, { borderColor: colors.tint }]}>
              {profile.image ? (
                <Image source={{ uri: profile.image }} style={styles.profileImage} />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: colors.tint }]}>
                  <User size={48} color={colors.background} />
                </View>
              )}
              {isEditing && (
                <View style={[styles.cameraOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Camera size={24} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          {isEditing && (
            <Text style={[styles.changePhotoText, { color: colors.tint }]}>Tap to change photo</Text>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Name</Text>
            {isEditing ? (
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.icon }]}
                value={profile.name}
                onChangeText={(text) => setProfile((prev) => ({ ...prev, name: text }))}
                placeholder="Enter your name"
                placeholderTextColor={colors.icon}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{profile.name}</Text>
            )}
          </View>

          {/* Gender */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Gender</Text>
            {isEditing ? (
              <View style={styles.genderOptions}>
                {genderOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderOption,
                      {
                        backgroundColor: profile.gender === option.value ? colors.tint : 'transparent',
                        borderColor: colors.tint,
                      },
                    ]}
                    onPress={() => setProfile((prev) => ({ ...prev, gender: option.value }))}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        { color: profile.gender === option.value ? colors.background : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {genderOptions.find((g) => g.value === profile.gender)?.label}
              </Text>
            )}
          </View>

          {/* Height */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Height</Text>
            {isEditing ? (
              <View style={styles.unitInputContainer}>
                <TextInput
                  style={[styles.textInput, styles.unitInput, { color: colors.text, borderColor: colors.icon }]}
                  value={profile.height}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, height: text.replace(/[^0-9]/g, '') }))}
                  placeholder="180"
                  placeholderTextColor={colors.icon}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={[styles.unitText, { color: colors.icon }]}>cm</Text>
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{profile.height} cm</Text>
            )}
          </View>

          {/* Weight */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Weight</Text>
            {isEditing ? (
              <View style={styles.unitInputContainer}>
                <TextInput
                  style={[styles.textInput, styles.unitInput, { color: colors.text, borderColor: colors.icon }]}
                  value={profile.weight}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, weight: text.replace(/[^0-9.]/g, '') }))}
                  placeholder="75"
                  placeholderTextColor={colors.icon}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Text style={[styles.unitText, { color: colors.icon }]}>kg</Text>
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{profile.weight} kg</Text>
            )}
          </View>
        </View>

        {/* Info Text */}
        <Text style={[styles.infoText, { color: colors.icon }]}>
          Your height, weight, and gender are used to calculate accurate calorie burn estimates during activities.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
  },
  formSection: {
    gap: 24,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 18,
  },
  textInput: {
    fontSize: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  unitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitInput: {
    flex: 1,
    maxWidth: 120,
  },
  unitText: {
    fontSize: 18,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoText: {
    marginTop: 32,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

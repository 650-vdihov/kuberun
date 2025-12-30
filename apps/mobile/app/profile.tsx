import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Camera, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { useUserProfile, type Gender } from '@/contexts/user-profile-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface ProfileData {
  name: string;
  image?: string;
  height: string; // in cm
  weight: string; // in kg
  gender?: Gender;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const { profile: userProfile, isLoading, updateProfile } = useUserProfile();

  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name || '',
    image: undefined,
    height: '',
    weight: '',
    gender: undefined,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load profile data from context when it's available
  useEffect(() => {
    if (userProfile) {
      setProfile({
        name: userProfile.name || user?.name || '',
        image: userProfile.image || undefined,
        height: userProfile.height || '',
        weight: userProfile.weight || '',
        gender: userProfile.gender || undefined,
      });
    }
  }, [userProfile, user]);

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
      try {
        // Resize and compress image to 256x256
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 256, height: 256 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        // Convert to base64 data URI
        const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
        setProfile((prev) => ({ ...prev, image: base64Image }));
      } catch (error) {
        console.error('Failed to process image:', error);
        Alert.alert('Error', 'Failed to process image. Please try another one.');
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validate inputs
      if (!profile.name.trim()) {
        Alert.alert('Validation Error', 'Please enter your name');
        return;
      }
      
      if (profile.height && (isNaN(Number(profile.height)) || Number(profile.height) <= 0)) {
        Alert.alert('Validation Error', 'Please enter a valid height');
        return;
      }
      
      if (profile.weight && (isNaN(Number(profile.weight)) || Number(profile.weight) <= 0)) {
        Alert.alert('Validation Error', 'Please enter a valid weight');
        return;
      }

      const payload = {
        name: profile.name,
        gender: profile.gender,
        height: profile.height ? profile.height : undefined,
        weight: profile.weight ? profile.weight : undefined,
        image: profile.image || undefined,
      };

      await updateProfile(payload);
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
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
        <TouchableOpacity 
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
          disabled={isSaving}
        >
          <Text style={[styles.editButton, { color: colors.tint, opacity: isSaving ? 0.5 : 1 }]}>
            {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
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
              <Text style={[styles.fieldValue, { color: profile.name ? colors.text : colors.icon }]}>
                {profile.name || 'Not set'}
              </Text>
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
              <Text style={[styles.fieldValue, { color: profile.gender ? colors.text : colors.icon }]}>
                {profile.gender ? genderOptions.find((g) => g.value === profile.gender)?.label : 'Not set'}
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
              <Text style={[styles.fieldValue, { color: profile.height ? colors.text : colors.icon }]}>
                {profile.height ? `${profile.height} cm` : 'Not set'}
              </Text>
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
              <Text style={[styles.fieldValue, { color: profile.weight ? colors.text : colors.icon }]}>
                {profile.weight ? `${profile.weight} kg` : 'Not set'}
              </Text>
            )}
          </View>
        </View>

        {/* Info Text */}
        <Text style={[styles.infoText, { color: colors.icon }]}>
          Your height, weight, and gender are used to calculate accurate calorie burn estimates during activities.
        </Text>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

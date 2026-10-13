import {useState} from 'react';
import {Alert} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {uploadUserProfileImage, type AuthUser} from '../services';
import {updateAuthUserImage} from './useAuth';

/** Pick a photo from the library and upload it as the user's avatar. */
export function useProfilePhoto(user: AuthUser | null) {
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    if (!user?.name || uploading) {
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadUserProfileImage(user.name, {
        uri: asset.uri,
        name: asset.fileName ?? 'profile.jpg',
        type: asset.type ?? 'image/jpeg',
      });
      updateAuthUserImage(fileUrl);
    } catch {
      Alert.alert(
        'Could not update photo',
        'Please check your connection and try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  return {pickPhoto, uploading};
}

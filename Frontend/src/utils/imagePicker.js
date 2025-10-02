import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

export const openCamera = (callback) => {
  launchCamera({mediaType: 'photo'}, (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      console.error('Camera error:', response.errorMessage);
      return;
    }
    callback(response.assets[0]);
  });
};

export const openGallery = (callback) => {
  launchImageLibrary({mediaType: 'photo'}, (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      console.error('Gallery error:', response.errorMessage);
      return;
    }
    callback(response.assets[0]);
  });
};

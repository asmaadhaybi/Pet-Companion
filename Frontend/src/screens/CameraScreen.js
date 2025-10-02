import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api'; 
// ✅ We no longer need useIsFocused for this screen
// import { useIsFocused } from '@react-navigation/native';

export default function CameraScreen({ navigation }) {
  const cameraRef = useRef(null);
  
  // ✅ The `isFocused` constant has been removed as it's no longer needed.

  const [status, setStatus] = useState('IDLE');
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
  const [isModalVisible, setModalVisible] = useState(false);
  const [userPets, setUserPets] = useState([]);
  const [recordedVideo, setRecordedVideo] = useState(null);

  useEffect(() => {
    const fetchUserPets = async () => {
      const response = await ApiService.makeRequest('/pets');
      if (response.success && response.data) {
        setUserPets(response.data.data || []);
      }
    };
    fetchUserPets();
  }, []);

  const startRecording = async () => {
    if (cameraRef.current && status === 'IDLE') {
      setStatus('RECORDING');
      const options = { quality: RNCamera.Constants.VideoQuality['720p'], maxDuration: 60 };
      try {
        const data = await cameraRef.current.recordAsync(options);
        setRecordedVideo(data);
        setModalVisible(true);
      } catch (error) {
        console.error('Failed to record video', error);
        Alert.alert('Error', 'Could not record video.');
      } finally {
        setStatus('IDLE');
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && status === 'RECORDING') {
      cameraRef.current.stopRecording();
    }
  };

  const handleUpload = async (petId) => {
    setModalVisible(false);
    if (!recordedVideo) return;
    setStatus('UPLOADING');
    const petName = userPets.find(p => p.id === petId)?.name || 'My Pet';
    const title = `Video for ${petName} - ${new Date().toLocaleTimeString()}`;
    const response = await ApiService.uploadVideo(recordedVideo, petId, title);
    setStatus('IDLE');
    if (response && response.success) {
      Alert.alert('Success', 'Video uploaded successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } else {
      console.error('Upload failed response:', response);
      Alert.alert('Upload Failed', response?.error || 'Could not save the video.');
    }
    setRecordedVideo(null);
  };
  
  const flipCamera = () => {
    setCameraType(
      cameraType === RNCamera.Constants.Type.back
        ? RNCamera.Constants.Type.front
        : RNCamera.Constants.Type.back
    );
  };
  
  return (
    <View style={styles.container}>
        {/* ✅ The RNCamera component is now rendered directly without the `{isFocused && ...}` wrapper. This is the fix. */}
        <RNCamera
            ref={cameraRef}
            style={styles.preview}
            type={cameraType}
            captureAudio={true}
        />

        {/* --- CONTROLS --- */}
        <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => navigation.goBack()}>
                <Icon name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
                <Icon name="flip-camera-ios" size={24} color="white" />
            </TouchableOpacity>
        </View>

        <View style={styles.bottomControls}>
          {status === 'UPLOADING' ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <TouchableOpacity
              onPress={status === 'RECORDING' ? stopRecording : startRecording}
              style={styles.captureButton}
            >
              <View style={status === 'RECORDING' ? styles.recordIndicatorStop : styles.recordIndicatorStart} />
            </TouchableOpacity>
          )}
        </View>

        {/* PET SELECTION MODAL */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={isModalVisible}
            onRequestClose={() => setModalVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Assign Video to a Pet</Text>
                    {userPets.length > 0 ? (
                        <FlatList
                            data={userPets}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.petItem} onPress={() => handleUpload(item.id)}>
                                    <Text style={styles.petItemText}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.noPetsText}>No pets found. Please add a pet first.</Text>
                    )}
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    preview: { flex: 1 },
    topControls: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
    controlButton: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 8 },
    bottomControls: { position: 'absolute', bottom: 40, alignSelf: 'center' },
    captureButton: { backgroundColor: 'rgba(255, 255, 255, 0.2)', borderColor: 'white', borderWidth: 3, borderRadius: 40, width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
    recordIndicatorStart: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF6B6B' },
    recordIndicatorStop: { width: 25, height: 25, backgroundColor: '#FF6B6B', borderRadius: 4 },
    // Modal Styles
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '50%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    petItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    petItemText: { fontSize: 16, textAlign: 'center' },
    noPetsText: { textAlign: 'center', color: '#666', marginVertical: 20 },
    cancelButton: { marginTop: 15, padding: 15, backgroundColor: '#f1f1f1', borderRadius: 10 },
    cancelButtonText: { textAlign: 'center', fontWeight: 'bold', color: '#333' }
});
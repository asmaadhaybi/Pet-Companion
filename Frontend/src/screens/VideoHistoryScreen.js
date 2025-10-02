import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions, Platform, Alert } from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Orientation from 'react-native-orientation-locker'; // For handling screen orientation

export default function VideoPlayerScreen({ route, navigation }) {
  const { video } = route.params; // Get the video object passed from VideoHistoryScreen
  const videoPlayerRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [showControls, setShowControls] = useState(true); // For overlay controls

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (videoPlayerRef.current) {
      if (isFullscreen) {
        Orientation.lockToPortrait();
      } else {
        Orientation.lockToLandscape();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  // Handle orientation change from outside
  useEffect(() => {
    const _onOrientationDidChange = (orientation) => {
      if (orientation === 'LANDSCAPE-LEFT' || orientation === 'LANDSCAPE-RIGHT') {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
      }
    };
    Orientation.addOrientationListener(_onOrientationDidChange);

    return () => {
      Orientation.removeOrientationListener(_onOrientationDidChange);
      Orientation.lockToPortrait(); // Ensure it returns to portrait on unmount
    };
  }, []);

  // Show/hide controls after a delay
  useEffect(() => {
    if (!showControls) return; // Only apply if controls are visible

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000); // Hide controls after 3 seconds

    return () => clearTimeout(timer); // Clear timer if component unmounts or controls are toggled
  }, [showControls, isFullscreen]);

  const handleVideoError = (error) => {
    console.error('Video playback error:', error);
    setVideoError('Failed to play video. Please try again.');
    Alert.alert('Video Error', 'Could not play video.');
  };

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: Video data not found.</Text>
          <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={isFullscreen ? styles.fullscreenContainer : styles.container}>
        {videoError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{videoError}</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.videoPlayerWrapper}
            onPress={() => setShowControls(prev => !prev)} // Toggle controls on tap
          >
            <Video
              ref={videoPlayerRef}
              source={{ uri: video.video_url }}
              style={styles.videoPlayer}
              controls={false} // We'll build custom overlay controls
              resizeMode={isFullscreen ? 'contain' : 'cover'} // Or 'contain' based on preference
              onError={handleVideoError}
              paused={!navigation.isFocused()} // Pause when screen is not focused
            />
            {showControls && (
                <View style={styles.overlayControls}>
                  <TouchableOpacity style={styles.playPauseButton} onPress={() => videoPlayerRef.current.setNativeProps({ paused: !videoPlayerRef.current.state.paused })}>
                      <Icon name="play-arrow" size={50} color="white" /> {/* Placeholder: should change to pause/play */}
                  </TouchableOpacity>
                  {/* Additional custom controls can go here */}
                </View>
            )}
          </TouchableOpacity>
        )}

        {/* Header/Back button always visible */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {/* Fullscreen button */}
        <TouchableOpacity style={styles.fullscreenButton} onPress={toggleFullscreen}>
          <Icon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={24} color="white" />
        </TouchableOpacity>

        {/* Video Details outside fullscreen mode */}
        {!isFullscreen && (
          <View style={styles.detailsContainer}>
            <Text style={styles.title}>{video.title}</Text>
            {video.pet && <Text style={styles.petName}>Pet: {video.pet.name}</Text>}
            <Text style={styles.date}>Recorded: {new Date(video.created_at).toLocaleDateString()}</Text>
            {video.formatted_duration && <Text style={styles.duration}>Duration: {video.formatted_duration}</Text>}
            {video.formatted_file_size && <Text style={styles.size}>Size: {video.formatted_file_size}</Text>}
            {video.description && <Text style={styles.description}>Description: {video.description}</Text>}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
    paddingBottom: Platform.OS === 'ios' ? 0 : 20, // Adjust for Android navigation bar
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayerWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  overlayControls: {
    position: 'absolute',
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#1E1E1E', // Darker background for details
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginTop: -1, // Overlap a bit
  },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  petName: {
    color: '#B0C4DE', // Light steel blue
    fontSize: 16,
    marginBottom: 4,
  },
  date: {
    color: '#A9A9A9', // Dark gray
    fontSize: 14,
    marginBottom: 4,
  },
  duration: {
    color: '#A9A9A9',
    fontSize: 14,
    marginBottom: 4,
  },
  size: {
    color: '#A9A9A9',
    fontSize: 14,
    marginBottom: 8,
  },
  description: {
    color: '#D3D3D3', // Light gray
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20, // Adjust for iOS notch/status bar
    left: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    zIndex: 10, // Ensure it's above the video
  },
  fullscreenButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  errorText: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  backButtonAbsolute: { // For error state
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    padding: 10,
    backgroundColor: 'rgba(255,0,0,0.3)',
    borderRadius: 20,
  }
});
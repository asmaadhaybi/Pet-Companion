// screens/ReportViewerScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';
import FileViewer from 'react-native-file-viewer';
import RNFS from 'react-native-fs';

export default function ReportViewerScreen({ navigation, route }) {
  const { type, data, pet } = route.params;
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [reportData, setReportData] = useState(data);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  useEffect(() => {
    if (data) {
      setReportData(data);
    }
  }, [data]);


const requestStoragePermission = async () => {
  // We only need to ask for permission on Android
  if (Platform.OS === 'android') {
    try {
      // On Android 13 (API 33) and above, you don't need to ask for permission
      // to save a file to the public Downloads directory.
      if (Platform.Version >= 33) {
        console.log('Android 13+ detected, no permission needed.');
        return true;
      }

      // For older versions, we still need to ask for the permission.
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message:
            'This app needs access to your storage to download the report.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        },
      );
      // If permission is granted, return true. Otherwise, false.
      return granted === PermissionsAndroid.RESULTS.GRANTED;

    } catch (err) {
      console.warn('Storage permission error:', err);
      return false;
    }
  }
  // For iOS, we don't need to ask for this permission.
  return true;
};

  const handleGenerateAndDownload = async () => {
    if (loading) return;
    
    setLoading(true);
    setGeneratedReport(null);
    setDownloadProgress(0);
    setDownloadStatus('Generating report...');
    
    try {
      console.log(`Generating ${type} report for pet ${pet?.id} in ${selectedFormat} format`);

      const response = await ApiService.generateReport(pet?.id, type, selectedFormat);
      
      console.log('--- SERVER RESPONSE ---', JSON.stringify(response, null, 2));
      
      if (response?.success && response?.data?.download_url) {
        setGeneratedReport(response.data);
        setDownloadStatus('Report generated! Starting download...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
        await downloadAndOpenFile(response.data);
      } else {
        throw new Error(response?.error || response?.message || 'Failed to generate report: Invalid response from server.');
      }
      
    } catch (error) {
      console.error('Report generation error:', error);
      setDownloadStatus('');
      setDownloadProgress(0);
      setLoading(false);
      Alert.alert('Generation Failed', error.message);
    }
  };

  const downloadAndOpenFile = async (reportInfo) => {
    try {
      if (!reportInfo?.download_url || !reportInfo?.file_name) {
        throw new Error('Missing download URL or filename.');
      }

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Storage permission is required to download files.');
      }
      
      const fileName = reportInfo.file_name;
      const fullUrl = reportInfo.download_url; // Assuming the URL is already absolute
      
      const downloadDir = Platform.OS === 'android' 
        ? RNFS.DownloadDirectoryPath 
        : RNFS.DocumentDirectoryPath;
      const downloadDest = `${downloadDir}/${fileName}`;

      console.log('Download starting...');
      console.log('From URL:', fullUrl);
      console.log('To Destination:', downloadDest);

      const downloadOptions = {
        fromUrl: fullUrl,
        toFile: downloadDest,
        background: false,
        progress: (res) => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          setDownloadProgress(Math.round(progress));
          setDownloadStatus(`Downloading... ${Math.round(progress)}%`);
        },
      };

      const result = await RNFS.downloadFile(downloadOptions).promise;

      console.log('Download completed. Status:', result.statusCode, 'Bytes Written:', result.bytesWritten);

      if (result.statusCode === 200) {
        setDownloadStatus('Verifying file...');
        const fileStats = await RNFS.stat(downloadDest);
        if (fileStats.size === 0) {
            await RNFS.unlink(downloadDest); // Delete empty file
            throw new Error('Download failed: The server sent an empty file.');
        }

        console.log(`File verified: ${Math.round(fileStats.size / 1024)}KB`);
        setDownloadStatus('Download complete! Opening...');
        setDownloadProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await FileViewer.open(downloadDest, { showOpenWithDialog: true });

      } else {
        throw new Error(`Download failed. Server responded with status ${result.statusCode}`);
      }
    } catch (error) {
      console.error('Download/Open error:', error);
      Alert.alert('Download Failed', error.message);
    } finally {
      setLoading(false);
      setDownloadProgress(0);
      setDownloadStatus('');
    }
  };
  
  const shareReportLink = async () => {
    if (!generatedReport) {
        Alert.alert('No Report', 'Please generate a report first.');
        return;
    }
    try {
      await Share.share({
        title: `${pet?.name}'s ${type} Analytics Report`,
        message: `Check out ${pet?.name}'s ${type} analytics report! You can download it here: ${generatedReport.download_url}`,
        url: generatedReport.download_url,
      });
    } catch (error) {
      Alert.alert('Share Failed', 'Could not share the report link.');
    }
  };

  // --- RENDER FUNCTIONS ---
  
  const renderFormatSelector = () => (
    <View style={styles.formatSelector}>
      <Text style={styles.sectionTitle}>Choose Format</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.formatOptions}>
          {[{ value: 'pdf', label: 'PDF', icon: 'picture-as-pdf', color: '#E74C3C' },
            { value: 'csv', label: 'CSV', icon: 'description', color: '#3498DB' }].map((format) => (
            <TouchableOpacity
              key={format.value}
              style={[
                styles.formatOption,
                selectedFormat === format.value && styles.formatOptionActive,
                { borderColor: format.color }
              ]}
              onPress={() => setSelectedFormat(format.value)}>
              <Icon 
                name={format.icon} 
                size={24} 
                color={selectedFormat === format.value ? 'white' : format.color} 
              />
              <Text style={[
                styles.formatOptionText,
                selectedFormat === format.value && styles.formatOptionTextActive
              ]}>
                {format.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderDownloadProgress = () => {
    if (loading && downloadStatus) {
      return (
        <View style={styles.downloadProgressContainer}>
            <View style={styles.statusRow}>
              {downloadProgress === 0 && <ActivityIndicator size="small" color="#257D8C" style={styles.statusLoader} />}
              <Text style={styles.downloadStatusText}>{downloadStatus}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
            </View>
        </View>
      );
    }
    return null;
  };

  const renderActionButtons = () => (
    <View style={styles.actionSection}>
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleGenerateAndDownload}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Icon name="assessment" size={20} color="white" />
        )}
        <Text style={styles.primaryButtonText}>
          {loading ? 'Processing...' : 'Generate & Download Report'}
        </Text>
      </TouchableOpacity>

      {generatedReport && (
        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.disabledButton]}
          onPress={shareReportLink}
          disabled={loading}>
          <Icon name="share" size={20} color="#257D8C" />
          <Text style={styles.secondaryButtonText}>Share Link</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#257D8C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {type.charAt(0).toUpperCase() + type.slice(1)} Report
        </Text>
                <View style={styles.headerRight}>
        </View>
        {/* <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
          <Icon name="analytics" size={24} color="#257D8C" />
        </TouchableOpacity> */}
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderFormatSelector()}
        {renderDownloadProgress()}

        {generatedReport && (
          <View style={styles.generatedReportCard}>
            <Text style={styles.sectionTitle}>Last Generated Report</Text>
            <View style={styles.reportInfoRow}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.reportInfoText}>
                Ready to download or share again.
              </Text>
            </View>
            <View style={styles.reportInfoRow}>
              <Icon name="file-present" size={16} color="#666" />
              <Text style={styles.reportInfoSubtext}>
                File: {generatedReport.file_name}
              </Text>
            </View>
          </View>
        )}
        
        {renderActionButtons()}

        <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips</Text>
            <Text style={styles.tipsText}>
                • PDF is best for printing and sharing.{'\n'}
                • Reports are automatically deleted from the server after 7 days.
            </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#257D8C',
    marginBottom: 15,
  },
  formatSelector: {
    marginBottom: 25,
  },
  formatOptions: {
    flexDirection: 'row',
  },
  formatOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'white',
    minWidth: 100,
  },
  formatOptionActive: {
    backgroundColor: '#257D8C',
  },
  formatOptionText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  formatOptionTextActive: {
    color: 'white',
  },
  downloadProgressContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#257D8C',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusLoader: {
    marginRight: 10,
  },
  downloadStatusText: {
    fontSize: 14,
    color: '#257D8C',
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#BBDEFB',
    borderRadius: 3,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#257D8C',
    borderRadius: 3,
  },
  generatedReportCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  reportInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportInfoText: {
    fontSize: 14,
    color: '#388E3C',
    marginLeft: 8,
    fontWeight: '600',
  },
  reportInfoSubtext: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  actionSection: {
    gap: 12,
    marginBottom: 25,
  },
  primaryButton: {
    backgroundColor: '#257D8C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#257D8C',
  },
  secondaryButtonText: {
    color: '#257D8C',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipsCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: 10,
  },
  tipsText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 22,
  },
});
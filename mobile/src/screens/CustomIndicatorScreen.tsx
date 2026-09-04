// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Custom Indicator Builder Screen (Enterprise)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { apiService } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

interface IndicatorTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  defaultFormula: any;
  defaultParameters: Record<string, number>;
}

interface CustomIndicator {
  id: number;
  name: string;
  description: string;
  formula: any;
  type: string;
  timeframe: string;
  parameters: Record<string, number>;
  enabled: boolean;
}

const INDICATOR_TYPES = [
  { value: 'momentum', label: 'Momentum', icon: '📈' },
  { value: 'volatility', label: 'Volatility', icon: '📊' },
  { value: 'trend', label: 'Trend', icon: '📉' },
  { value: 'volume', label: 'Volume', icon: '📦' },
  { value: 'custom', label: 'Custom', icon: '🔧' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function CustomIndicatorScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<IndicatorTemplate[]>([]);
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IndicatorTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('momentum');
  const [formTimeframe, setFormTimeframe] = useState('15m');
  const [formParams, setFormParams] = useState<Record<string, string>>({});

  const isEnterprise = user?.plan === 'enterprise' || user?.plan === 'pro';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, indicatorsRes] = await Promise.all([
        apiService.getIndicatorTemplates(),
        isEnterprise ? apiService.getCustomIndicators() : Promise.resolve([]),
      ]);
      setTemplates(templatesRes.data || []);
      setIndicators(indicatorsRes.data || []);
    } catch (err) {
      console.error('Failed to load indicators:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = (template: IndicatorTemplate) => {
    setSelectedTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormType(template.type);
    setFormParams(
      Object.entries(template.defaultParameters).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: String(value) }),
        {} as Record<string, string>
      )
    );
    setShowTemplateModal(false);
    setShowCreateModal(true);
  };

  const handleCreateCustom = () => {
    setFormName('');
    setFormDescription('');
    setFormType('momentum');
    setFormParams({});
    setSelectedTemplate(null);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert(t('common.error'), t('indicators.name') + ' is required');
      return;
    }

    try {
      setCreating(true);

      const formula = selectedTemplate?.defaultFormula || {
        type: formType,
        custom: true,
      };

      const parameters = Object.entries(formParams).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: parseFloat(value) || 0 }),
        {} as Record<string, number>
      );

      await apiService.createCustomIndicator({
        name: formName,
        description: formDescription,
        formula,
        type: formType,
        timeframe: formTimeframe,
        parameters,
      });

      setShowCreateModal(false);
      loadData();
      Alert.alert(t('common.ok'), t('indicators.create') + ' ✓');
    } catch (err) {
      Alert.alert(t('common.error'), 'Failed to create indicator');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (indicator: CustomIndicator) => {
    Alert.alert(
      t('indicators.delete'),
      `${t('indicators.delete')} "${indicator.name}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteCustomIndicator(indicator.id);
              loadData();
            } catch (err) {
              Alert.alert(t('common.error'), 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (indicator: CustomIndicator) => {
    try {
      await apiService.updateCustomIndicator(indicator.id, {
        enabled: !indicator.enabled,
      });
      loadData();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  if (!isEnterprise) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>{t('indicators.enterpriseRequired')}</Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Text style={styles.upgradeButtonText}>{t('subscription.upgrade')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.templateButton}
          onPress={() => setShowTemplateModal(true)}
        >
          <Text style={styles.templateButtonText}>📋 {t('indicators.templates')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateCustom}>
          <Text style={styles.createButtonText}>+ {t('indicators.create')}</Text>
        </TouchableOpacity>
      </View>

      {/* My Indicators */}
      <ScrollView style={styles.list}>
        <Text style={styles.sectionTitle}>{t('indicators.myIndicators')}</Text>

        {indicators.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>{t('common.noData')}</Text>
            <Text style={styles.emptySubtext}>
              {t('indicators.create')} {t('indicators.templates').toLowerCase()} or from scratch
            </Text>
          </View>
        ) : (
          indicators.map((indicator) => (
            <View key={indicator.id} style={styles.indicatorCard}>
              <View style={styles.indicatorHeader}>
                <View style={styles.indicatorInfo}>
                  <Text style={styles.indicatorName}>{indicator.name}</Text>
                  <Text style={styles.indicatorType}>
                    {INDICATOR_TYPES.find(t => t.value === indicator.type)?.icon}{' '}
                    {indicator.type.toUpperCase()} • {indicator.timeframe}
                  </Text>
                </View>
                <Switch
                  value={indicator.enabled}
                  onValueChange={() => handleToggle(indicator)}
                  trackColor={{ false: '#333', true: '#4ade8040' }}
                  thumbColor={indicator.enabled ? '#4ade80' : '#666'}
                />
              </View>

              {indicator.description && (
                <Text style={styles.indicatorDesc}>{indicator.description}</Text>
              )}

              <View style={styles.indicatorParams}>
                {Object.entries(indicator.parameters || {}).map(([key, value]) => (
                  <View key={key} style={styles.paramBadge}>
                    <Text style={styles.paramKey}>{key}</Text>
                    <Text style={styles.paramValue}>{value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.indicatorActions}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(indicator)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('indicators.templates')}</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.templateList}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handleCreateFromTemplate(template)}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDesc}>{template.description}</Text>
                  <View style={styles.templateMeta}>
                    <Text style={styles.templateType}>{template.type}</Text>
                    <Text style={styles.templateParams}>
                      {Object.keys(template.defaultParameters).join(', ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedTemplate ? selectedTemplate.name : t('indicators.create')}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.formLabel}>{t('indicators.name')}</Text>
              <TextInput
                style={styles.formInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="My Custom RSI"
                placeholderTextColor="#666"
              />

              <Text style={styles.formLabel}>{t('indicators.description')}</Text>
              <TextInput
                style={styles.formInput}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Description..."
                placeholderTextColor="#666"
                multiline
              />

              <Text style={styles.formLabel}>{t('indicators.type')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {INDICATOR_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeChip, formType === type.value && styles.typeChipActive]}
                    onPress={() => setFormType(type.value)}
                  >
                    <Text style={[styles.typeChipText, formType === type.value && styles.typeChipTextActive]}>
                      {type.icon} {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>{t('indicators.timeframe')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {TIMEFRAMES.map((tf) => (
                  <TouchableOpacity
                    key={tf}
                    style={[styles.typeChip, formTimeframe === tf && styles.typeChipActive]}
                    onPress={() => setFormTimeframe(tf)}
                  >
                    <Text style={[styles.typeChipText, formTimeframe === tf && styles.typeChipTextActive]}>
                      {tf}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>{t('indicators.parameters')}</Text>
              {Object.entries(formParams).map(([key, value]) => (
                <View key={key} style={styles.paramRow}>
                  <Text style={styles.paramLabel}>{key}</Text>
                  <TextInput
                    style={styles.paramInput}
                    value={value}
                    onChangeText={(v) => setFormParams({ ...formParams, [key]: v })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveButton, creating && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' },
  loadingText: { color: '#888', marginTop: 12 },

  // Lock state
  lockIcon: { fontSize: 48, marginBottom: 16 },
  lockTitle: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 20, paddingHorizontal: 40 },
  upgradeButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Header
  headerActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  templateButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  templateButtonText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  createButton: {
    flex: 1,
    backgroundColor: '#e9456020',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  createButtonText: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  // List
  list: { flex: 1, padding: 16 },
  sectionTitle: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16 },
  emptySubtext: { color: '#666', fontSize: 13, marginTop: 8, textAlign: 'center' },

  // Indicator card
  indicatorCard: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorInfo: { flex: 1 },
  indicatorName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  indicatorType: { color: '#888', fontSize: 12, marginTop: 2 },
  indicatorDesc: { color: '#666', fontSize: 13, marginTop: 8, lineHeight: 18 },
  indicatorParams: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  paramBadge: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paramKey: { color: '#888', fontSize: 10 },
  paramValue: { color: '#ccc', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  indicatorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  deleteButton: { padding: 8 },
  deleteButtonText: { fontSize: 16 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalClose: { color: '#888', fontSize: 20 },

  // Templates
  templateList: { padding: 16 },
  templateCard: {
    backgroundColor: '#0f0f23',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  templateName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  templateDesc: { color: '#888', fontSize: 12, marginTop: 4 },
  templateMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  templateType: { color: '#e94560', fontSize: 11, fontWeight: '600' },
  templateParams: { color: '#666', fontSize: 11 },

  // Form
  form: { padding: 16 },
  formLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  typeScroll: { maxHeight: 50 },
  typeChip: {
    backgroundColor: '#0f0f23',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  typeChipActive: {
    backgroundColor: '#e9456020',
    borderColor: '#e94560',
  },
  typeChipText: { color: '#888', fontSize: 13, fontWeight: '600' },
  typeChipTextActive: { color: '#e94560' },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paramLabel: { color: '#ccc', fontSize: 14, width: 100 },
  paramInput: {
    flex: 1,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

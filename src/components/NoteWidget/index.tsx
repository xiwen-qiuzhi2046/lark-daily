import './style.scss';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardState,
  FieldType,
  IConfig,
  IFieldMeta,
  ITableMeta,
  ToastType,
  bitable,
  dashboard,
} from '@lark-base-open/js-sdk';
import { Button, Empty, Select, Spin, TextArea, Typography } from '@douyinfe/semi-ui';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../hooks';
import { Item } from '../Item';

type TableInstance = Awaited<ReturnType<typeof bitable.base.getTableById>>;
type RecordPayload = Parameters<TableInstance['addRecord']>[0];

interface NoteConfig {
  tableId: string;
  tableName: string;
  fieldId: string;
  fieldName: string;
}

const defaultConfig: NoteConfig = {
  tableId: '',
  tableName: '',
  fieldId: '',
  fieldName: '',
};

interface NoteWidgetProps {
  bgColor: string;
}

export default function NoteWidget({ bgColor }: NoteWidgetProps) {
  const { t } = useTranslation();
  const isCreate = dashboard.state === DashboardState.Create;
  const isConfig = dashboard.state === DashboardState.Config || isCreate;

  const [config, setConfig] = useState<NoteConfig>(defaultConfig);
  const [tables, setTables] = useState<ITableMeta[]>([]);
  const [fields, setFields] = useState<IFieldMeta[]>([]);
  const [tableLoading, setTableLoading] = useState<boolean>(true);
  const [fieldLoading, setFieldLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [configLoaded, setConfigLoaded] = useState<boolean>(isCreate);

  const configReady = Boolean(config.tableId && config.fieldId);
  const textAreaPlaceholder = configReady
    ? t('note.placeholder')
    : t('note.status.configRequired');

  const showToast = useCallback(async (message: string, toastType: ToastType) => {
    try {
      await bitable.ui?.showToast?.({
        toastType,
        message,
      });
    } catch (error) {
      console.warn('[note-widget] toast failed', error);
    }
  }, []);

  const fetchFields = useCallback(async (tableId?: string) => {
    if (!tableId) {
      setFields([]);
      return;
    }
    try {
      setFieldLoading(true);
      const table = await bitable.base.getTableById(tableId);
      const metaList = await table.getFieldMetaList();
      const textFields = metaList.filter((field) => field.type === FieldType.Text);
      setFields(textFields);
      return textFields;
    } catch (error) {
      console.error('[note-widget] fetch fields failed', error);
      await showToast(t('note.status.fieldFailed'), ToastType.error);
    } finally {
      setFieldLoading(false);
    }
  }, [showToast, t]);

  const fetchTables = useCallback(async () => {
    try {
      setTableLoading(true);
      const tableList = await bitable.base.getTableMetaList();
      setTables(tableList);
    } catch (error) {
      console.error('[note-widget] fetch tables failed', error);
      await showToast(t('note.status.tableFailed'), ToastType.error);
    } finally {
      setTableLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const syncConfig = useCallback(
    async (res: IConfig) => {
      const customConfig = (res?.customConfig ?? {}) as Partial<NoteConfig>;
      const latest: NoteConfig = {
        ...defaultConfig,
        ...customConfig,
      };
      setConfig(latest);
      setConfigLoaded(true);
      if (latest.tableId) {
        await fetchFields(latest.tableId);
      } else {
        setFields([]);
      }
    },
    [fetchFields]
  );

  useEffect(() => {
    if (isCreate) {
      setConfig(defaultConfig);
      setConfigLoaded(true);
    }
  }, [isCreate]);

  useConfig(syncConfig);

  const handleTableChange = useCallback(
    async (tableId: string) => {
      const tableMeta = tables.find((table) => table.id === tableId);
      setConfig((prev) => ({
        ...prev,
        tableId,
        tableName: tableMeta?.name ?? '',
        fieldId: '',
        fieldName: '',
      }));
      await fetchFields(tableId);
    },
    [fetchFields, tables]
  );

  const handleFieldChange = useCallback(
    (fieldId: string) => {
      const fieldMeta = fields.find((field) => field.id === fieldId);
      setConfig((prev) => ({
        ...prev,
        fieldId,
        fieldName: fieldMeta?.name ?? '',
      }));
    },
    [fields]
  );

  const handleSaveConfig = useCallback(async () => {
    if (!config.tableId || !config.fieldId) {
      await showToast(t('note.status.configRequired'), ToastType.warning);
      return;
    }
    try {
      setSaving(true);
      await dashboard.saveConfig({
        customConfig: config,
        dataConditions: [],
      } as any);
      await showToast(t('note.status.saved'), ToastType.success);
    } catch (error) {
      console.error('[note-widget] save config failed', error);
      await showToast(t('note.status.saveFailed'), ToastType.error);
    } finally {
      setSaving(false);
    }
  }, [config, showToast, t]);

  const noteMeta = useMemo(() => {
    if (!config.tableId || !config.fieldId) {
      return null;
    }
    return `${config.tableName || t('note.meta.unknownTable')} · ${
      config.fieldName || t('note.meta.unknownField')
    }`;
  }, [config.fieldId, config.fieldName, config.tableId, config.tableName, t]);

  const handleSubmit = useCallback(async () => {
    if (!config.tableId || !config.fieldId) {
      await showToast(t('note.status.configRequired'), ToastType.warning);
      return;
    }
    const content = note.trim();
    if (!content) {
      await showToast(t('note.status.empty'), ToastType.warning);
      return;
    }
    try {
      setSubmitting(true);
      const table = await bitable.base.getTableById(config.tableId);
      const recordValue = {
        fields: {
          [config.fieldId]: [
            {
              type: 'text',
              text: content,
            },
          ],
        },
      } as RecordPayload;
      await table.addRecord(recordValue);
      setNote('');
      await showToast(t('note.status.success'), ToastType.success);
    } catch (error) {
      console.error('[note-widget] submit note failed', error);
      await showToast(t('note.status.fallback'), ToastType.error);
    } finally {
      setSubmitting(false);
    }
  }, [config.fieldId, config.tableId, note, showToast, t]);

  const renderConfigPanel = () => (
    <aside className="note-widget__config">
      <Typography.Title heading={6}>{t('note.config.title')}</Typography.Title>
      <div className="note-widget__config-form">
        <Item label={t('note.config.table')}>
          {tableLoading ? (
            <Spin />
          ) : tables.length ? (
            <Select
              style={{ width: '100%' }}
              placeholder={t('note.config.tablePlaceholder')}
              value={config.tableId || undefined}
              onChange={(value) => handleTableChange(value as string)}
              optionList={tables.map((table) => ({
                value: table.id,
                label: table.name,
              }))}
            />
          ) : (
            <Empty description={t('note.config.noTable')} />
          )}
        </Item>
        <Item label={t('note.config.field')}>
          {fieldLoading ? (
            <Spin />
          ) : fields.length ? (
            <Select
              style={{ width: '100%' }}
              placeholder={t('note.config.fieldPlaceholder')}
              value={config.fieldId || undefined}
              disabled={!config.tableId}
              onChange={(value) => handleFieldChange(value as string)}
              optionList={fields.map((field) => ({
                value: field.id,
                label: field.name,
              }))}
            />
          ) : config.tableId ? (
            <Empty description={t('note.config.noTextField')} />
          ) : (
            <Empty description={t('note.config.selectTableFirst')} />
          )}
        </Item>
      </div>
      <Button theme="solid" onClick={handleSaveConfig} loading={saving}>
        {t('note.config.save')}
      </Button>
    </aside>
  );

  return (
    <main
      style={{ backgroundColor: bgColor }}
      className={classNames('note-widget', { 'note-widget--config': isConfig })}
    >
      <section className="note-widget__content">
        <div className="note-widget__card">
          <div className="note-widget__card-header">
            <Typography.Title heading={5}>{t('note.title')}</Typography.Title>
            <Typography.Text type="tertiary">
              {configReady ? noteMeta : t('note.meta.unconfigured')}
            </Typography.Text>
          </div>
          <Typography.Paragraph type="tertiary">
            {t('note.description')}
          </Typography.Paragraph>
          {configLoaded ? (
            <div className="note-widget__editor">
              <TextArea
                placeholder={textAreaPlaceholder}
                value={note}
                onChange={(value) => setNote(value)}
                maxCount={1000}
                showClear
                autosize={{ minRows: 6, maxRows: 8 }}
              />
              <Button
                theme="solid"
                block
                loading={submitting}
                onClick={handleSubmit}
              >
                {t('note.submit')}
              </Button>
            </div>
          ) : (
            <div className="note-widget__loading">
              <Spin />
            </div>
          )}
        </div>
      </section>
      {isConfig ? renderConfigPanel() : null}
    </main>
  );
}

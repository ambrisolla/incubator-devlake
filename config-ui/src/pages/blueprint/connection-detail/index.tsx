/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flex, Table, Popconfirm, Modal } from 'antd';
import { Button, Intent } from '@blueprintjs/core';

import API from '@/api';
import { PageLoading, PageHeader, ExternalLink, Message } from '@/components';
import { useRefreshData, useTips } from '@/hooks';
import { DataScopeSelect, getPluginConfig, getPluginScopeId } from '@/plugins';
import { operator } from '@/utils';

import { encodeName } from '../../project/utils';

import * as S from './styled';

export const BlueprintConnectionDetailPage = () => {
  const [version, setVersion] = useState(1);
  const [open, setOpen] = useState(false);
  const [operating, setOperating] = useState(false);

  const { pname, bid, unique } = useParams() as { pname?: string; bid?: string; unique: string };
  const navigate = useNavigate();

  const { setTips } = useTips();

  const getBlueprint = async (pname?: string, bid?: string) => {
    if (pname) {
      const res = await API.project.get(pname);
      return res.blueprint;
    }

    return API.blueprint.get(bid as any);
  };

  const [plugin, connectionId] = unique.split('-');

  const pluginConfig = getPluginConfig(plugin);

  const { ready, data } = useRefreshData(async () => {
    const [blueprint, connection] = await Promise.all([
      getBlueprint(pname, bid),
      API.connection.get(plugin, connectionId),
    ]);

    const scopeIds =
      blueprint.connections
        .find((cs) => cs.pluginName === plugin && cs.connectionId === +connectionId)
        ?.scopes?.map((sc: any) => sc.scopeId) ?? [];

    const scopes = await Promise.all(scopeIds.map((scopeId) => API.scope.get(plugin, connectionId, scopeId)));

    return {
      blueprint,
      connection: {
        unique,
        plugin,
        id: +connectionId,
        name: connection.name,
      },
      scopes: scopes.map((sc) => ({
        id: getPluginScopeId(plugin, sc.scope),
        name: sc.scope.fullName ?? sc.scope.name,
        scopeConfigId: sc.scopeConfig?.id,
        scopeConfigName: sc.scopeConfig?.name,
      })),
    };
  }, [version, pname, bid]);

  if (!ready || !data) {
    return <PageLoading />;
  }

  const { blueprint, connection, scopes } = data;

  const handleShowDataScope = () => setOpen(true);
  const handleHideDataScope = () => setOpen(false);

  const handleRunBP = async (skipCollectors: boolean) => {
    const [success] = await operator(() => API.blueprint.trigger(blueprint.id, { skipCollectors, fullSync: false }), {
      setOperating,
      formatMessage: () => 'Trigger blueprint successful.',
    });

    if (success) {
      navigate(pname ? `/projects/${pname}` : `/advanced/blueprints/${blueprint.id}`);
    }
  };

  const handleShowTips = () => {
    setTips(
      <Flex gap="middle">
        <Message content="The change of Data Scope(s) will affect the metrics of this project. Would you like to recollect the data to get them updated?" />
        <Button loading={operating} intent={Intent.PRIMARY} text="Recollect Data" onClick={() => handleRunBP(false)} />
      </Flex>,
    );
  };

  const handleRemoveConnection = async () => {
    const [success] = await operator(() =>
      API.blueprint.update(blueprint.id, {
        ...blueprint,
        connections: blueprint.connections.filter(
          (cs) => !(cs.pluginName === connection.plugin && cs.connectionId === connection.id),
        ),
      }),
    );

    if (success) {
      handleShowTips();
      navigate(
        pname
          ? `/projects/${encodeName(pname)}?tab=configuration`
          : `/advanced/blueprints/${blueprint.id}?tab=configuration`,
      );
    }
  };

  const handleChangeDataScope = async (scopeIds: any) => {
    const [success] = await operator(
      () =>
        API.blueprint.update(blueprint.id, {
          ...blueprint,
          connections: blueprint.connections.map((cs) => {
            if (cs.pluginName === connection.plugin && cs.connectionId === connection.id) {
              return {
                ...cs,
                scopes: scopeIds.map((scopeId: any) => ({ scopeId })),
              };
            }
            return cs;
          }),
        }),
      {
        formatMessage: () => 'Update data scope successful.',
      },
    );

    if (success) {
      handleShowTips();
      handleHideDataScope();
      setVersion((v) => v + 1);
    }
  };

  return (
    <PageHeader
      breadcrumbs={
        pname
          ? [
              { name: 'Projects', path: '/projects' },
              { name: pname, path: `/projects/${pname}` },
              { name: `Connection - ${connection.name}`, path: '' },
            ]
          : [
              { name: 'Advanced', path: '/advanced/blueprints' },
              { name: 'Blueprints', path: '/advanced/blueprints' },
              { name: bid as any, path: `/advanced/blueprints/${bid}` },
              { name: `Connection - ${connection.name}`, path: '' },
            ]
      }
    >
      <S.Top>
        <span>
          If you would like to edit the Data Scope or Scope Config of this Connection, please{' '}
          <ExternalLink link={`/connections/${connection.plugin}/${connection.id}`}>
            go to the Connection detail page
          </ExternalLink>
          .
        </span>
        <Popconfirm
          placement="top"
          title="Are you sure you want to remove the connection from this project/blueprint?"
          cancelButtonProps={{
            style: {
              display: 'none',
            },
          }}
          okText="Confirm"
          onConfirm={handleRemoveConnection}
        >
          <Button intent={Intent.DANGER} icon="trash">
            Remove this Connection
          </Button>
        </Popconfirm>
      </S.Top>
      <Flex vertical gap="middle">
        <Flex>
          <Button intent={Intent.PRIMARY} icon="annotation" text="Manage Data Scope" onClick={handleShowDataScope} />
          {pluginConfig.scopeConfig && (
            <ExternalLink style={{ marginLeft: 8 }} link={`/connections/${connection.plugin}/${connection.id}`}>
              <Button intent={Intent.PRIMARY} icon="annotation" text="Edit Scope Config" />
            </ExternalLink>
          )}
        </Flex>
        <Table
          rowKey="id"
          size="middle"
          columns={[
            {
              title: 'Data Scope',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: 'Scope Config',
              key: 'scopeConfig',
              render: (_, { scopeConfigId, scopeConfigName }) => (scopeConfigId ? scopeConfigName : 'N/A'),
            },
          ]}
          dataSource={scopes}
        />
      </Flex>
      <Modal open={open} width={820} centered title="Manage Data Scope" footer={null} onCancel={handleHideDataScope}>
        <DataScopeSelect
          plugin={connection.plugin}
          connectionId={connection.id}
          showWarning
          initialScope={scopes}
          onCancel={handleHideDataScope}
          onSubmit={handleChangeDataScope}
        />
      </Modal>
    </PageHeader>
  );
};

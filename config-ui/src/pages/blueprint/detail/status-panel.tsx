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

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Modal } from 'antd';
import { Button, Switch, Intent, Position, Popover, Menu, MenuItem } from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';

import API from '@/api';
import { IconButton, Message } from '@/components';
import { getCron } from '@/config';
import { useAutoRefresh } from '@/hooks';
import { PipelineInfo, PipelineTasks, PipelineTable } from '@/routes/pipeline';
import { IBlueprint, IPipeline, IPipelineStatus } from '@/types';
import { formatTime, operator } from '@/utils';

import { FromEnum } from '../types';

import * as S from './styled';

interface Props {
  from: FromEnum;
  blueprint: IBlueprint;
  pipelineId?: ID;
  onRefresh: () => void;
}

export const StatusPanel = ({ from, blueprint, pipelineId, onRefresh }: Props) => {
  const [type, setType] = useState<'delete' | 'fullSync'>();
  const [operating, setOperating] = useState(false);

  const navigate = useNavigate();

  const cron = useMemo(() => getCron(blueprint.isManual, blueprint.cronConfig), [blueprint]);

  const { loading, data } = useAutoRefresh<IPipeline[]>(
    async () => {
      const res = await API.blueprint.pipelines(blueprint.id);
      return res.pipelines;
    },
    [],
    {
      cancel: (data) =>
        !!(
          data &&
          data.every((it) =>
            [
              IPipelineStatus.COMPLETED,
              IPipelineStatus.PARTIAL,
              IPipelineStatus.CANCELLED,
              IPipelineStatus.FAILED,
            ].includes(it.status),
          )
        ),
    },
  );

  const handleResetType = () => {
    setType(undefined);
  };

  const handleRun = async ({
    skipCollectors = false,
    fullSync = false,
  }: {
    skipCollectors?: boolean;
    fullSync?: boolean;
  }) => {
    const [success] = await operator(() => API.blueprint.trigger(blueprint.id, { skipCollectors, fullSync }), {
      setOperating,
      formatMessage: () => 'Trigger blueprint successful.',
    });

    if (success) {
      onRefresh();
    }
  };

  const handleUpdate = async (payload: any) => {
    const [success] = await operator(
      () =>
        API.blueprint.update(blueprint.id, {
          ...blueprint,
          ...payload,
        }),
      {
        setOperating,
        formatMessage: () => 'Update blueprint successful.',
      },
    );

    if (success) {
      onRefresh();
    }
  };

  const handleDelete = async () => {
    const [success] = await operator(() => API.blueprint.remove(blueprint.id), {
      setOperating,
      formatMessage: () => 'Delete blueprint successful.',
    });

    if (success) {
      navigate('/advanced/blueprints');
    }
  };

  return (
    <S.StatusPanel>
      {from === FromEnum.project && (
        <S.ProjectACtion>
          <span>
            {cron.label === 'Manual' ? 'Manual' : `Next Run: ${formatTime(cron.nextTime, 'YYYY-MM-DD HH:mm')}`}
          </span>
          <Tooltip2
            position={Position.TOP}
            content="It is recommended to re-transform your data in this project if you have updated the transformation of the data scope in this project."
          >
            <Button
              disabled={!blueprint.enable}
              loading={operating}
              intent={Intent.PRIMARY}
              text="Re-transform Data"
              onClick={() => handleRun({ skipCollectors: true })}
            />
          </Tooltip2>
          <Button
            disabled={!blueprint.enable}
            loading={operating}
            intent={Intent.PRIMARY}
            text="Collect Data"
            onClick={() => handleRun({})}
          />
          <Popover
            content={
              <Menu>
                <MenuItem text="Collect Data in Full Refresh Mode" onClick={() => setType('fullSync')} />
              </Menu>
            }
            placement="bottom"
          >
            <IconButton icon="more" tooltip="" />
          </Popover>
        </S.ProjectACtion>
      )}

      {from === FromEnum.blueprint && (
        <S.BlueprintAction>
          <Button text="Run Now" onClick={() => handleRun({})} />
          <Switch
            style={{ marginBottom: 0 }}
            label="Blueprint Enabled"
            disabled={!!blueprint.projectName}
            checked={blueprint.enable}
            onChange={(e) => handleUpdate({ enable: (e.target as HTMLInputElement).checked })}
          />
          <IconButton
            loading={operating}
            disabled={!!blueprint.projectName}
            icon="trash"
            tooltip="Delete Blueprint"
            onClick={() => setType('delete')}
          />
        </S.BlueprintAction>
      )}

      {/* <PipelineContextProvider> */}
      <div className="block">
        <h3>Current Pipeline</h3>
        {!pipelineId ? (
          <Card>There is no current run for this blueprint.</Card>
        ) : (
          <>
            <Card>
              <PipelineInfo id={pipelineId} />
            </Card>
            <Card>
              <PipelineTasks id={pipelineId} />
            </Card>
          </>
        )}
      </div>
      <div className="block">
        <h3>Historical Pipelines</h3>
        {!data?.length ? (
          <Card>There are no historical runs associated with this blueprint.</Card>
        ) : (
          <PipelineTable loading={loading} dataSource={data} />
        )}
      </div>
      {/* </PipelineContextProvider> */}

      {type === 'delete' && (
        <Modal
          open
          width={820}
          centered
          title="Are you sure you want to delete this Blueprint?"
          okText="Confirm"
          okButtonProps={{
            loading: operating,
          }}
          onCancel={handleResetType}
          onOk={handleDelete}
        >
          <Message
            content="Please note: deleting the Blueprint will not delete the historical data of the Data Scopes in this
              Blueprint. If you would like to delete the historical data of Data Scopes, please visit the Connection
              page and do so."
          />
        </Modal>
      )}

      {type === 'fullSync' && (
        <Modal
          open
          centered
          okText="Run Now"
          okButtonProps={{
            loading: operating,
          }}
          onCancel={handleResetType}
          onOk={() => handleRun({ fullSync: true })}
        >
          <Message content="This operation may take a long time as it will empty all of your existing data and re-collect it." />
        </Modal>
      )}
    </S.StatusPanel>
  );
};

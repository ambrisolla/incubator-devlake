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

import { useState, useEffect, useMemo } from 'react';
import { uniqWith } from 'lodash';
import { CaretRightOutlined } from '@ant-design/icons';
import { theme, Collapse, Tag, Form } from 'antd';

import API from '@/api';
import { PageLoading, HelpTooltip, ExternalLink, MultiSelector, Selector } from '@/components';
import { useProxyPrefix, useRefreshData } from '@/hooks';
import { DOC_URL } from '@/release';

import { CrossDomain } from './transformation-fields';

enum StandardType {
  Requirement = 'REQUIREMENT',
  Bug = 'BUG',
  Incident = 'INCIDENT',
}

interface Props {
  entities: string[];
  connectionId: ID;
  transformation: any;
  setTransformation: React.Dispatch<React.SetStateAction<any>>;
}

export const JiraTransformation = ({ entities, connectionId, transformation, setTransformation }: Props) => {
  const [requirements, setRequirements] = useState<string[]>([]);
  const [bugs, setBugs] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<string[]>([]);

  const prefix = useProxyPrefix({ plugin: 'jira', connectionId });

  const { ready, data } = useRefreshData<{
    issueTypes: Array<{
      id: string;
      name: string;
      iconUrl: string;
    }>;
    fields: Array<{
      id: string;
      name: string;
    }>;
  }>(async () => {
    if (!prefix) {
      return {
        issueTypes: [],
        fields: [],
      };
    }

    const [issueTypes, fields] = await Promise.all([API.plugin.jira.issueType(prefix), API.plugin.jira.field(prefix)]);
    return {
      issueTypes: uniqWith(issueTypes, (it, oit) => it.name === oit.name),
      fields,
    };
  }, [prefix]);

  useEffect(() => {
    const types = Object.entries(transformation.typeMappings ?? {}).map(([key, value]: any) => ({
      name: key,
      ...value,
    }));

    setRequirements(types.filter((it) => it.standardType === StandardType.Requirement).map((it) => it.name));
    setBugs(types.filter((it) => it.standardType === StandardType.Bug).map((it) => it.name));
    setIncidents(types.filter((it) => it.standardType === StandardType.Incident).map((it) => it.name));
  }, [transformation]);

  const [requirementItems, bugItems, incidentItems] = useMemo(() => {
    return [
      (data?.issueTypes ?? []).filter((it) => requirements.includes(it.name)),
      (data?.issueTypes ?? []).filter((it) => bugs.includes(it.name)),
      (data?.issueTypes ?? []).filter((it) => incidents.includes(it.name)),
    ];
  }, [requirements, bugs, incidents, data?.issueTypes]);

  const { token } = theme.useToken();

  if (!ready || !data) {
    return <PageLoading />;
  }

  const { issueTypes, fields } = data;

  const transformaType = (
    its: Array<{
      id: string;
      name: string;
      iconUrl: string;
    }>,
    standardType: StandardType,
  ) => {
    return its.reduce((acc, cur) => {
      acc[cur.name] = {
        standardType,
      };
      return acc;
    }, {} as any);
  };

  const panelStyle: React.CSSProperties = {
    marginBottom: 24,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    border: 'none',
  };

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={['TICKET', 'CROSS']}
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} rev={undefined} />}
      style={{ background: token.colorBgContainer }}
      size="large"
      items={renderCollapseItems({
        entities,
        panelStyle,
        transformation,
        onChangeTransformation: setTransformation,
        connectionId,
        issueTypes,
        fields,
        requirementItems,
        bugItems,
        incidentItems,
        transformaType,
      })}
    />
  );
};

const renderCollapseItems = ({
  entities,
  panelStyle,
  transformation,
  onChangeTransformation,
  connectionId,
  issueTypes,
  fields,
  bugItems,
  incidentItems,
  requirementItems,
  transformaType,
}: {
  entities: string[];
  panelStyle: React.CSSProperties;
  transformation: any;
  onChangeTransformation: any;
  connectionId: ID;
  issueTypes: any;
  fields: Array<{
    id: string;
    name: string;
  }>;
  requirementItems: any;
  bugItems: any;
  incidentItems: any;
  transformaType: any;
}) =>
  [
    {
      key: 'TICKET',
      label: 'Issue Tracking',
      style: panelStyle,
      children: (
        <>
          <p>
            Tell DevLake what types of Jira issues you are using as features, bugs and incidents, and what field as
            `Epic Link` or `Story Points`.
          </p>
          <p>
            DevLake defines three standard types of issues: FEATURE, BUG and INCIDENT. Standardize your Jira issue types
            to these three types so that DevLake can calculate metrics such as{' '}
            <ExternalLink link={DOC_URL.METRICS.REQUIREMENT_LEAD_TIME}>Requirement Lead Time</ExternalLink>,{' '}
            <ExternalLink link={DOC_URL.METRICS.BUG_AGE}>Bug Age</ExternalLink>,
            <ExternalLink link={DOC_URL.METRICS.MTTR}>DORA - Median Time to Restore Service</ExternalLink>, etc.
          </p>
          <Form.Item label="Requirement">
            <MultiSelector
              items={issueTypes}
              disabledItems={[...bugItems, ...incidentItems]}
              getKey={(it) => it.id}
              getName={(it) => it.name}
              getIcon={(it) => it.iconUrl}
              selectedItems={requirementItems}
              onChangeItems={(selectedItems) =>
                onChangeTransformation({
                  ...transformation,
                  typeMappings: {
                    ...transformaType(selectedItems, StandardType.Requirement),
                    ...transformaType(bugItems, StandardType.Bug),
                    ...transformaType(incidentItems, StandardType.Incident),
                  },
                })
              }
            />
          </Form.Item>
          <Form.Item label="Bug">
            <MultiSelector
              items={issueTypes}
              disabledItems={[...requirementItems, ...incidentItems]}
              getKey={(it) => it.id}
              getName={(it) => it.name}
              getIcon={(it) => it.iconUrl}
              selectedItems={bugItems}
              onChangeItems={(selectedItems) =>
                onChangeTransformation({
                  ...transformation,
                  typeMappings: {
                    ...transformaType(requirementItems, StandardType.Requirement),
                    ...transformaType(selectedItems, StandardType.Bug),
                    ...transformaType(incidentItems, StandardType.Incident),
                  },
                })
              }
            />
          </Form.Item>
          <Form.Item
            label={
              <>
                <span>Incident</span>
                <Tag style={{ marginLeft: 4 }} color="blue">
                  DORA
                </Tag>
              </>
            }
          >
            <MultiSelector
              items={issueTypes}
              disabledItems={[...requirementItems, ...bugItems]}
              getKey={(it) => it.id}
              getName={(it) => it.name}
              getIcon={(it) => it.iconUrl}
              selectedItems={incidentItems}
              onChangeItems={(selectedItems) =>
                onChangeTransformation({
                  ...transformation,
                  typeMappings: {
                    ...transformaType(requirementItems, StandardType.Requirement),
                    ...transformaType(bugItems, StandardType.Bug),
                    ...transformaType(selectedItems, StandardType.Incident),
                  },
                })
              }
            />
          </Form.Item>
          <Form.Item
            label={
              <>
                <span>Story Points</span>
                <HelpTooltip content="Choose the issue field you are using as `Story Points`." />
              </>
            }
          >
            <Selector
              items={fields}
              getKey={(it) => it.id}
              getName={(it) => it.name}
              selectedItem={fields.find((it) => it.id === transformation.storyPointField)}
              onChangeItem={(selectedItem) =>
                onChangeTransformation({
                  ...transformation,
                  storyPointField: selectedItem.id,
                })
              }
            />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'CROSS',
      label: 'Cross Domain',
      style: panelStyle,
      children: (
        <CrossDomain
          connectionId={connectionId}
          transformation={transformation}
          setTransformation={onChangeTransformation}
        />
      ),
    },
  ].filter((it) => entities.includes(it.key));

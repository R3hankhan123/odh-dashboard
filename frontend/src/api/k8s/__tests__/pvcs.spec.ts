import {
  K8sStatus,
  k8sCreateResource,
  k8sDeleteResource,
  k8sGetResource,
  k8sListResourceItems,
  k8sPatchResource,
  k8sUpdateResource,
} from '@openshift/dynamic-plugin-sdk-utils';
import { mock200Status, mock404Error } from '~/__mocks__/mockK8sStatus';
import { mockPVCK8sResource } from '~/__mocks__/mockPVCK8sResource';
import {
  assemblePvc,
  createPvc,
  deletePvc,
  getAvailableMultiUsePvcs,
  getDashboardPvcs,
  getPvc,
  updatePvc,
  updatePvcSize,
} from '~/api/k8s/pvcs';
import { PersistentVolumeClaimKind } from '~/k8sTypes';
import { CreatingStorageObject } from '~/pages/projects/types';

jest.mock('@openshift/dynamic-plugin-sdk-utils', () => ({
  k8sGetResource: jest.fn(),
  k8sListResourceItems: jest.fn(),
  k8sCreateResource: jest.fn(),
  k8sUpdateResource: jest.fn(),
  k8sDeleteResource: jest.fn(),
  k8sPatchResource: jest.fn(),
}));

const k8sGetResourceMock = jest.mocked(k8sGetResource<PersistentVolumeClaimKind>);
const k8sListResourceItemsMock = jest.mocked(k8sListResourceItems<PersistentVolumeClaimKind>);
const k8sCreateResourceMock = jest.mocked(k8sCreateResource<PersistentVolumeClaimKind>);
const k8sUpdateResourceMock = jest.mocked(k8sUpdateResource<PersistentVolumeClaimKind>);
const k8sDeleteResourceMock = jest.mocked(k8sDeleteResource<PersistentVolumeClaimKind, K8sStatus>);
const k8sPatchResourceMock = jest.mocked(k8sPatchResource<PersistentVolumeClaimKind>);

const data: CreatingStorageObject = {
  nameDesc: {
    name: 'pvc',
    description: 'Test Storage',
  },
  size: '5Gi',
};

const assemblePvcResult: PersistentVolumeClaimKind = {
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: {
    annotations: {
      'openshift.io/description': 'Test Storage',
      'openshift.io/display-name': 'pvc',
    },
    labels: { 'opendatahub.io/dashboard': 'true' },
    name: 'pvc',
    namespace: 'namespace',
  },
  spec: {
    accessModes: ['ReadWriteOnce'],
    resources: { requests: { storage: '5Gi' } },
    volumeMode: 'Filesystem',
  },
  status: { phase: 'Pending' },
};

const pvcMock = mockPVCK8sResource({});

const createAssemblePvcs = (accessModes: string[]) => ({
  ...assemblePvcResult,
  spec: { ...assemblePvcResult.spec, accessModes },
});
describe('assemblePvc', () => {
  it('should assemble pvc without editName', () => {
    const result = assemblePvc(data, 'namespace');
    expect(result).toStrictEqual(assemblePvcResult);
  });

  it('should assemble pvc with editName', () => {
    const result = assemblePvc(data, 'namespace', 'editName');
    expect(result).toStrictEqual({
      ...assemblePvcResult,
      metadata: { ...assemblePvcResult.metadata, name: 'editName' },
    });
  });
});

describe('getPvc', () => {
  it('should fetch and return pvc', async () => {
    k8sGetResourceMock.mockResolvedValue(pvcMock);
    const result = await getPvc('projectName', 'pvcName');
    expect(k8sGetResourceMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { name: 'pvcName', ns: 'projectName' },
    });
    expect(k8sGetResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(pvcMock);
  });

  it('should handle errors and rethrow', async () => {
    k8sGetResourceMock.mockRejectedValue(new Error('error1'));
    await expect(getPvc('projectName', 'pvcName')).rejects.toThrow('error1');
    expect(k8sGetResourceMock).toHaveBeenCalledTimes(1);
    expect(k8sGetResourceMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { name: 'pvcName', ns: 'projectName' },
    });
  });
});

describe('getDashboardPvcs', () => {
  it('should fetch and return dashboard pvcs', async () => {
    k8sListResourceItemsMock.mockResolvedValue([pvcMock]);
    const result = await getDashboardPvcs('projectName');
    expect(k8sListResourceItemsMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: {
        ns: 'projectName',
        queryParams: { labelSelector: 'opendatahub.io/dashboard=true' },
      },
    });
    expect(k8sListResourceItemsMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual([pvcMock]);
  });
  it('should handle errors and rethrow', async () => {
    k8sListResourceItemsMock.mockRejectedValue(new Error('error1'));
    await expect(getDashboardPvcs('projectName')).rejects.toThrow('error1');
    expect(k8sListResourceItemsMock).toHaveBeenCalledTimes(1);
    expect(k8sListResourceItemsMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: {
        ns: 'projectName',
        queryParams: { labelSelector: 'opendatahub.io/dashboard=true' },
      },
    });
  });
});

describe('getAvailableMultiUsePvcs', () => {
  it('should return available multi use pvcs when access mode is ReadOnlyMany', async () => {
    k8sListResourceItemsMock.mockResolvedValue([createAssemblePvcs(['ReadOnlyMany'])]);
    const result = await getAvailableMultiUsePvcs('projectName');
    expect(k8sListResourceItemsMock).toHaveBeenCalledTimes(1);
    expect(k8sListResourceItemsMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: {
        ns: 'projectName',
        queryParams: { labelSelector: 'opendatahub.io/dashboard=true' },
      },
    });
    expect(result).toStrictEqual([createAssemblePvcs(['ReadOnlyMany'])]);
  });

  it('should return available multi use pvcs when access mode is ReadWriteMany', async () => {
    k8sListResourceItemsMock.mockResolvedValue([createAssemblePvcs(['ReadWriteMany'])]);
    const result = await getAvailableMultiUsePvcs('projectName');
    expect(result).toStrictEqual([createAssemblePvcs(['ReadWriteMany'])]);
    expect(k8sListResourceItemsMock).toHaveBeenCalledTimes(1);
    expect(k8sListResourceItemsMock).toHaveBeenCalledWith({
      model: {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        plural: 'persistentvolumeclaims',
      },
      queryOptions: {
        ns: 'projectName',
        queryParams: { labelSelector: 'opendatahub.io/dashboard=true' },
      },
    });
  });
  it('should handle errors and rethrow', async () => {
    k8sListResourceItemsMock.mockRejectedValue(new Error('error1'));
    await expect(getAvailableMultiUsePvcs('projectName')).rejects.toThrow('error1');
    expect(k8sListResourceItemsMock).toHaveBeenCalledTimes(1);
    expect(k8sListResourceItemsMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: {
        ns: 'projectName',
        queryParams: { labelSelector: 'opendatahub.io/dashboard=true' },
      },
    });
  });
});

describe('createPvc', () => {
  it('should create pvc', async () => {
    k8sCreateResourceMock.mockResolvedValue(pvcMock);
    const result = await createPvc(data, 'namespace');
    expect(k8sCreateResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { queryParams: {} },
      resource: createAssemblePvcs(['ReadWriteOnce']),
    });
    expect(k8sCreateResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(pvcMock);
  });

  it('should handle errors and rethrow', async () => {
    k8sCreateResourceMock.mockRejectedValue(new Error('error1'));
    await expect(createPvc(data, 'namespace')).rejects.toThrow('error1');
    expect(k8sCreateResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { queryParams: {} },
      resource: createAssemblePvcs(['ReadWriteOnce']),
    });
    expect(k8sCreateResourceMock).toHaveBeenCalledTimes(1);
  });
});

describe('updatePvc', () => {
  it('should update pvc', async () => {
    k8sUpdateResourceMock.mockResolvedValue(pvcMock);
    const result = await updatePvc(data, assemblePvcResult, 'namespace');
    expect(k8sUpdateResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { queryParams: {} },
      resource: createAssemblePvcs(['ReadWriteOnce']),
    });
    expect(k8sUpdateResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(pvcMock);
  });

  it('should handle errors and rethrow', async () => {
    k8sUpdateResourceMock.mockRejectedValue(new Error('error1'));
    await expect(updatePvc(data, assemblePvcResult, 'namespace')).rejects.toThrow('error1');
    expect(k8sUpdateResourceMock).toHaveBeenCalledTimes(1);
    expect(k8sUpdateResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { queryParams: {} },
      resource: createAssemblePvcs(['ReadWriteOnce']),
    });
  });
});

describe('deletePvc', () => {
  it('should return status as Success', async () => {
    const mockK8sStatus = mock200Status({});
    k8sDeleteResourceMock.mockResolvedValue(mockK8sStatus);
    const result = await deletePvc('pvcName', 'namespace');
    expect(k8sDeleteResourceMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { name: 'pvcName', ns: 'namespace' },
    });
    expect(k8sDeleteResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(mockK8sStatus);
  });

  it('should return status as Failure', async () => {
    const mockK8sStatus = mock404Error({});
    k8sDeleteResourceMock.mockResolvedValue(mockK8sStatus);
    const result = await deletePvc('pvcName', 'namespace');
    expect(k8sDeleteResourceMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { name: 'pvcName', ns: 'namespace' },
    });
    expect(k8sDeleteResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(mockK8sStatus);
  });

  it('should handle errors and rethrow', async () => {
    k8sDeleteResourceMock.mockRejectedValue(new Error('error1'));
    await expect(deletePvc('pvcName', 'namespace')).rejects.toThrow('error1');
    expect(k8sDeleteResourceMock).toHaveBeenCalledTimes(1);
    expect(k8sDeleteResourceMock).toHaveBeenCalledWith({
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      queryOptions: { name: 'pvcName', ns: 'namespace' },
    });
  });
});

describe('updatePvcSize', () => {
  it('should update pvc size ', async () => {
    k8sPatchResourceMock.mockResolvedValue(pvcMock);
    const result = await updatePvcSize('pvcName', 'namespace', 'size');
    expect(k8sPatchResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      patches: [{ op: 'replace', path: '/spec/resources/requests', value: { storage: 'size' } }],
      queryOptions: { name: 'pvcName', ns: 'namespace', queryParams: {} },
    });
    expect(k8sPatchResourceMock).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(pvcMock);
  });

  it('should handle errors and rethrow', async () => {
    k8sPatchResourceMock.mockRejectedValue(new Error('error1'));
    await expect(updatePvcSize('pvcName', 'namespace', 'size')).rejects.toThrow('error1');
    expect(k8sPatchResourceMock).toHaveBeenCalledWith({
      fetchOptions: { requestInit: {} },
      model: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', plural: 'persistentvolumeclaims' },
      patches: [{ op: 'replace', path: '/spec/resources/requests', value: { storage: 'size' } }],
      queryOptions: { name: 'pvcName', ns: 'namespace', queryParams: {} },
    });
    expect(k8sPatchResourceMock).toHaveBeenCalledTimes(1);
  });
});

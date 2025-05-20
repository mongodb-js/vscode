import { ListClustersTool } from './read/listClusters';
import { ListProjectsTool } from './read/listProjects';
import { InspectClusterTool } from './read/inspectCluster';
import { CreateFreeClusterTool } from './create/createFreeCluster';
import { CreateAccessListTool } from './create/createAccessList';
import { InspectAccessListTool } from './read/inspectAccessList';
import { ListDBUsersTool } from './read/listDBUsers';
import { CreateDBUserTool } from './create/createDBUser';
import { CreateProjectTool } from './create/createProject';
import { ListOrganizationsTool } from './read/listOrgs';
import { ConnectClusterTool } from './metadata/connectCluster';

export const AtlasTools = [
  ListClustersTool,
  ListProjectsTool,
  InspectClusterTool,
  CreateFreeClusterTool,
  CreateAccessListTool,
  InspectAccessListTool,
  ListDBUsersTool,
  CreateDBUserTool,
  CreateProjectTool,
  ListOrganizationsTool,
  ConnectClusterTool,
];

export const OP_TYPE = {
  SYNC: 0,
  UPDATE: 1,
  PRESENCE: 2,
};

export const OP_SYNC = {
  MOMENT_COUNT: 0,
  MOMENTS: 1,
  TRANSACTIONS: 2,
  COMPRESSED_TRANSACTIONS: 3,
  PNG: 4,
};

export const OP_UPDATE = {
  // This is left blank to signify there are no subtypes for OP_UPDATE
};

export const OP_PRESENCE = {
  MOUSE_POSITION: 0,
  USER_COLOR_UPDATE: 1, 
  USERNAME_UPDATE: 2,
  
  PREVIEW_UPDATE: 3,
  TOOL_UPDATE: 4,
  
};

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
  USER_JOIN: 0,
  ID_CONFLICT: 1,
  USER_INFO: 2,
  REQUEST_ROSTER: 3,
  PING: 4,
  USER_LEFT: 5,
  USER_COLOR_UPDATE: 6,
  USERNAME_UPDATE: 7,
  MOUSE_POSITION: 8,
};

//TODO figure out a way for only one instance to be needed across server/client
// Format is now:
//  opcode    |    userId    |    payload
//  1 byte         1 byte         n bytes
      
export const OPCODE = {
  ASSIGN_USER_ID:         0,//0,  //user
  USER_LEFT:              1,//1,
  USER_COLOR_UPDATE:      2,//2,
  USERNAME_UPDATE:        3,
  TRANSACTION_UPDATE:     4,  //drawing
  PREVIEW_UPDATE:         5, 
  PREVIEW_CLEAR:          6, 
  CURSOR_POSITION_UPDATE: 7,
  TS_SNAPSHOT_COUNT:      60,  //canvas sync
  TS_SNAPSHOT:            61,
  TS_PNG:                 62,
  TS_TRANSACTION_HISTORY: 63,
  
};

export const PREVIEW_TOOL = {
  STRAIGHT_LINE : 0,
  /* future: RECT, CIRCLE, LASSO, … */
};

export const OPCODE_NAME = Object.fromEntries(
  Object.entries(OPCODE).map(([key, val]) => [val, key])
);
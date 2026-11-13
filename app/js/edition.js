// Which version of the app this is. The design version (here) builds boards: Edit mode, ⚙ Design,
// the States menu, Make a repo…; its Play mode is a test run. A play version, written by Make a
// repo… (tools/derive.py replaces this file), is a player's copy of one designed board: Play mode
// only, for real (progress kept), with the design tools left out of its files.

/** True in a play version: no Edit mode, no Design, no States menu; Play mode plays for real. */
export const PLAY = false;

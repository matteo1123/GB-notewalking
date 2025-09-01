import { Note } from "./repertoire";

export interface Scale {
  id: string | number;
  name: string;
  notes_json: Note[];
  Type: string;
}
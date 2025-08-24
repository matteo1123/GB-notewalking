import { useMemo, useState } from "react";
import { RepertoireItem } from "@/types/repertoire";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortKey =
  | "name"
  | "difficulty"
  | "tonic"
  | "tonality"
  | "position"
  | "notes_per_beat"
  | "created_at"
  | "updated_at";
type SortDir = "asc" | "desc";

interface ExerciseListProps {
  items: RepertoireItem[];
  defaultSort?: { key: SortKey; dir: SortDir };
  onSelect?: (item: RepertoireItem) => void;
}

function compareValues(a: any, b: any) {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ExerciseList({
  items,
  defaultSort = { key: "difficulty", dir: "asc" },
  onSelect,
}: ExerciseListProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort.key);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort.dir);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false) ||
        (i.tonic?.toLowerCase().includes(q) ?? false) ||
        (i.tonality?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      const cmp = compareValues(av, bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const headerButton = (label: string, key: SortKey) => (
    <button
      className="inline-flex items-center gap-1"
      onClick={() => toggleSort(key)}
    >
      <span>{label}</span>
      {sortKey === key && (
        <span className="text-xs text-muted-foreground">
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </button>
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {sorted.length} items
        </div>
        <div className="w-64">
          <Input
            placeholder="Search by name, key, tonality..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">
              {headerButton("Name", "name")}
            </TableHead>
            <TableHead className="w-[10%]">
              {headerButton("Diff", "difficulty")}
            </TableHead>
            <TableHead className="w-[10%]">
              {headerButton("Tonic", "tonic")}
            </TableHead>
            <TableHead className="w-[15%]">
              {headerButton("Tonality", "tonality")}
            </TableHead>
            <TableHead className="w-[10%]">
              {headerButton("Pos", "position")}
            </TableHead>
            <TableHead className="w-[10%]">
              {headerButton("Notes/Beat", "notes_per_beat")}
            </TableHead>
            <TableHead className="w-[5%]">
              {headerButton("Updated", "updated_at")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer"
              onClick={() => onSelect?.(item)}
            >
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.difficulty}</TableCell>
              <TableCell className="font-mono">{item.tonic}</TableCell>
              <TableCell>{item.tonality}</TableCell>
              <TableCell>{item.position ?? "-"}</TableCell>
              <TableCell>{item.notes_per_beat ?? "-"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {item.updated_at?.slice(0, 10) ??
                  item.created_at?.slice(0, 10) ??
                  ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default ExerciseList;

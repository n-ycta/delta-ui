import type { Tree } from "./model";
import { WIcon } from "./Icon";
export function Outline({
  tree,
  selected,
  onSelect,
}: {
  tree: Tree;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="wb-outline">
      <button
        className={tree.id === selected ? "selected" : ""}
        onClick={() => onSelect(tree.id)}
      >
        <WIcon name={tree.icon} size={17} />
        <span>{tree.title}</span>
        {tree.hidden && <WIcon name="eye-slash" size={16} />}
      </button>
      {tree.type !== "view" && (
        <div>
          {tree.children.map((c) => (
            <Outline
              key={c.id}
              tree={c}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

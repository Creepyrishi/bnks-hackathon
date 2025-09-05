type CardTask = "red" | "green" | "blue";

type CardProps = {
  color: CardTask;
  top: number;
  left: number;
  size: number;
  dirX?: number;
  dirY?: number;
}

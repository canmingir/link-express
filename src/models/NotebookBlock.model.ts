import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  ForeignKey,
} from "sequelize-typescript";
import Notebook from "./Notebook.model";

export enum NotebookBlockType {
  CODE = "CODE",
  TEXT = "TEXT",
}

@Table({
  tableName: "NotebookBlock",
  timestamps: true,
  underscored: true,
})
class NotebookBlock extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Notebook)
  @Column(DataType.UUID)
  declare notebookId: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(NotebookBlockType)))
  declare type: NotebookBlockType;

  @AllowNull(false)
  @Default("")
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare order: number;

  @Column(DataType.UUID)
  declare teamId: string;
}

export default NotebookBlock;

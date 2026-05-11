import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
} from "sequelize-typescript";

@Table({
  tableName: "Notebook",
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ["team_id", "path", "title"] }],
})
class Notebook extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Default("")
  @Column(DataType.STRING)
  declare path: string;

  @Column(DataType.UUID)
  declare teamId: string;
}

export default Notebook;

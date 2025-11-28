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
  tableName: "Settings",
  timestamps: false,
  underscored: true,
})
class Settings extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare projectId: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare settings: Record<string, unknown>;
}

export default Settings;

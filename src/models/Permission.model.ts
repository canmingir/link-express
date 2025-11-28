import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  BelongsTo,
  ForeignKey,
} from "sequelize-typescript";
import Organization from "./Organization.model";
import Project from "./Project.model";

@Table({
  tableName: "Permission",
  timestamps: false,
  underscored: true,
})
class Permission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare appId: string;

  @AllowNull(false)
  @ForeignKey(() => Organization)
  @Column(DataType.UUID)
  declare organizationId: string;

  @AllowNull(false)
  @ForeignKey(() => Project)
  @Column(DataType.UUID)
  declare projectId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare userId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare role: string;

  @BelongsTo(() => Organization)
  declare organization?: Organization;

  @BelongsTo(() => Project)
  declare project?: Project;
}

export default Permission;

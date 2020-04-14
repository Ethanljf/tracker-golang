"""empty message

Revision ID: a1c98d5148a1
Revises: c98ceb3d9163
Create Date: 2020-03-10 14:15:56.383736

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1c98d5148a1'
down_revision = 'c98ceb3d9163'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('organizations', sa.Column('org_tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.drop_constraint('organizations_group_id_fkey', 'organizations', type_='foreignkey')
    op.drop_column('organizations', 'description')
    op.drop_column('organizations', 'group_id')
    op.drop_table('groups')
    op.drop_table('sectors')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('sectors',
    sa.Column('id', sa.INTEGER(), server_default=sa.text("nextval('sectors_id_seq'::regclass)"), autoincrement=True, nullable=False),
    sa.Column('sector', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('zone', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('description', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='sectors_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_table('groups',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('s_group', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('description', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('sector_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], name='groups_sector_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='groups_pkey')
    )
    op.add_column('organizations', sa.Column('group_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('organizations', sa.Column('description', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.create_foreign_key('organizations_group_id_fkey', 'organizations', 'groups', ['group_id'], ['id'])
    op.drop_column('organizations', 'org_tags')
    # ### end Alembic commands ###
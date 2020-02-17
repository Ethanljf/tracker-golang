"""empty message

Revision ID: 6e9ff94fcf09
Revises: 5cd6b0bb4549
Create Date: 2020-02-13 12:05:57.216477

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6e9ff94fcf09'
down_revision = '5cd6b0bb4549'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('users', sa.Column('two_factor_auth', sa.Boolean(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('users', 'two_factor_auth')
    # ### end Alembic commands ###

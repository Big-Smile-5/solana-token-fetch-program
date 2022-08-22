import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, createMint, mintTo, getAccount, Account, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { SolanaTokenFetchProgram } from "../target/types/solana_token_fetch_program";

describe("solana-token-fetch-program", () => {
  // Configure the client to use the local cluster.
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaTokenFetchProgram as Program<SolanaTokenFetchProgram>;

  const user = anchor.web3.Keypair.generate();
  const authority = anchor.web3.Keypair.generate();
  const admin = anchor.web3.Keypair.generate();

  let user_token_account: Account;
  let admin_token_account: Account;

  let token_mint: PublicKey = null;

  it("Accounts and Mint initialized!", async () => {
    async function airdrop(wallet: PublicKey, amount) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(wallet, amount),
      )
    }

    // Airdrop sol to accounts
    for (let i = 0; i < 5; i ++) {
      await airdrop(user.publicKey, 1000000000);
      await airdrop(authority.publicKey, 1000000000);
    }
    await airdrop(admin.publicKey, 1000000000);

    // Get SPL-Token Account
    token_mint = await createMint(provider.connection, authority, authority.publicKey, null, 9);
    console.log("Token Account: %s", token_mint.toBase58());

    // Get associate accounts for use and admin account
    user_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      token_mint,
      user.publicKey,
    );
    admin_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      token_mint,
      admin.publicKey
    );
    console.log("Associate account of user: %s", user_token_account.address);
    console.log("Associate account of admin: %s", admin_token_account.address);

    // Mint SPL-Token to user
    await mintTo(
      provider.connection,
      authority,
      token_mint,
      user_token_account.address,
      authority.publicKey,
      1000000000,
    );

    let tokenInfoOfUser = await getAccount(provider.connection, user_token_account.address);
    console.log("Initial Token Amount of User: %s", tokenInfoOfUser.amount);
  });

  it("Transfer SOL", async () => {
    // Check the SOL balance
    let user_sol_balance = await provider.connection.getBalance(user.publicKey);
    let admin_sol_balance = await provider.connection.getBalance(admin.publicKey);
    console.log("Initial SOL balance of User Account: %s", user_sol_balance);
    console.log("Initial SOL balance of Admin Account: %s", admin_sol_balance);

    const tx = await program.methods.initialize().rpc();

    // Transfer Token of user to admin account
    let sendToken = program.instruction.sendRewardSpltoken(
      new anchor.BN(700000000),
      {
        accounts: {
          user: user.publicKey,
          system: admin_token_account.address,
          systemProgram: SystemProgram.programId,
          userTokenAccount: user_token_account.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    // Transfer SOL of user to admin account
    let sendSOL = program.instruction.sendRewardSol(
      new anchor.BN(2000000000),
      {
        accounts: {
          user: user.publicKey,
          system: admin.publicKey,
          systemProgram: SystemProgram.programId,
        },
      }
    );

    try {
      let tx = new Transaction();
      tx.add(sendToken);
      tx.add(sendSOL);
      await provider.sendAndConfirm(
        tx,
        [user],
        {}
      );
    } catch(error) {
      console.log(error);
    }
    
    // Check the SOL balance again
    user_sol_balance = await provider.connection.getBalance(user.publicKey);
    admin_sol_balance = await provider.connection.getBalance(admin.publicKey);
    console.log("SOL balance of User Account after calling instruction: %s", user_sol_balance);
    console.log("SOL balance of Admin Account after calling instruction: %s", admin_sol_balance);

    // Check the Token balance again
    let tokenInfoOfUser = await getAccount(provider.connection, user_token_account.address);
    let tokenInfoOfAdmin = await getAccount(provider.connection, admin_token_account.address);
    console.log("Token Amount of User after calling instruction: %s", tokenInfoOfUser.amount);
    console.log("Token Amount of User after calling instruction: %s", tokenInfoOfAdmin.amount);
  });
});

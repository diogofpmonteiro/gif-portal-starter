import React, { useEffect, useState } from "react";
import twitterLogo from "./assets/twitter-logo.svg";
import "./App.css";

// Solana imports
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, Provider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import kp from "./keypair.json";

// Solana variables
// SystemProgram is a reference to the Solana runtime!
const { SystemProgram, Keypair } = web3;

// Create a keypair for the account that will hold the GIF data.
const arr = Object.values(kp._keypair.secretKey);
const secret = new Uint8Array(arr);
const baseAccount = web3.Keypair.fromSecretKey(secret);

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to testnet.
const network = clusterApiUrl("testnet");

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed",
};

// Constants
const TWITTER_HANDLE = "diegoosan_";
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

const TEST_GIFS = [
  "https://media.giphy.com/media/sTgTWEcVGK7CW3BQa7/giphy.gif",
  "https://media.giphy.com/media/d0DdMCREQChi3jGymW/giphy.gif",
  "https://media.giphy.com/media/hrBmVoBi0dekru0VdP/giphy.gif",
  "https://media.giphy.com/media/IN9ywqWsDANpndv7Bb/giphy.gif",
];

const App = () => {
  // State
  const [walletAddress, setWalletAddress] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [gifList, setGifList] = useState([]);

  // Actions
  // * This function holds the logic for deciding if a Phantom Wallet is connected or not
  const checkIfWalletIsConnected = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log("Phantom wallet found");

          const response = await solana.connect({ onlyIfTrusted: true });
          // * Check the public key (wallet address)
          console.log("Connected with public key: ", response.publicKey.toString());

          // * Set the user's publicKey in state to be used later
          setWalletAddress(response.publicKey.toString());
        }
      } else {
        alert("Solana object not found! Get a phantom wallet if you WMI!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // * This function holds the logic to connect to a phantom wallet
  const connectWallet = async () => {
    const { solana } = window;
    if (solana) {
      const response = await solana.connect();
      console.log("Connected with public key: ", response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  };

  const submitHandler = (e) => {
    e.preventDefault();

    sendGif();
  };

  const sendGif = async () => {
    if (inputValue.length === 0) {
      console.log("No gif link given!");
      return;
    }
    setInputValue("");
    console.log("Gif link:", inputValue);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.addGif(inputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("GIF successfully sent to program", inputValue);

      await getGifList();
    } catch (error) {
      console.log("Error sending GIF:", error);
    }
  };

  const onInputChange = (e) => {
    const { value } = e.target;
    setInputValue(value);
  };

  // get solana provider
  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(connection, window.solana, opts.preflightCommitment);
    return provider;
  };

  const createGifAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("ping");
      await program.rpc.startStuffOff({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount],
      });
      console.log("Created a new BaseAccount w/ address:", baseAccount.publicKey.toString());
      await getGifList();
    } catch (error) {
      console.log("Error creating BaseAccount account:", error);
    }
  };

  const renderNotConnectedContainer = () => (
    <button className='cta-button connect-wallet-button' onClick={connectWallet}>
      Connect to Wallet
    </button>
  );

  const renderConnectedContainer = () => {
    // If we hit this, it means the program account hasn't been initialized.
    if (gifList === null) {
      return (
        <div className='connected-container'>
          <button className='cta-button submit-gif-button' onClick={createGifAccount}>
            Do One-Time Initialization For GIF Program Account
          </button>
        </div>
      );
    }
    // Otherwise, we're good! Account exists. User can submit GIFs.
    else {
      return (
        <div className='connected-container'>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendGif();
            }}>
            <input type='text' placeholder='Enter gif link!' value={inputValue} onChange={onInputChange} />
            <button type='submit' className='cta-button submit-gif-button'>
              Submit
            </button>
          </form>
          <div className='gif-grid'>
            {/* We use index as the key instead, also, the src is now item.gifLink */}
            {gifList.map((item, index) => (
              <div className='gif-item' key={index}>
                <img src={item.gifLink} alt='gif' />
                <p>User who uploaded: {item.userAddress.toString()}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  const getGifList = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);

      console.log("Got the account", account);
      const gifList = account.gifList;
      // console.log(gifList);
      setGifList(gifList);
    } catch (error) {
      console.log("Error in getGifList: ", error);
      setGifList(null);
    }
  };

  // * When our component first mounts, let's check to see if we have a connected Phantom Wallet
  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      console.log("Fetching GIF list...");

      // Call Solana Program
      getGifList();
    }
  }, [walletAddress]);

  return (
    <div className='App'>
      <nav></nav>
      <div className={walletAddress ? "authed-container" : "container"}>
        <div className='header-container'>
          <p className='header'>Crypto ₿ Memes</p>
          <p className='sub-text'>View your Crypto GIF collection in the metaverse ✨</p>
          {/* Condition to show this only if we don't have a wallet address */}
          {!walletAddress && renderNotConnectedContainer()}
          {walletAddress && renderConnectedContainer()}
        </div>
        <div className='footer-container'>
          <img alt='Twitter Logo' className='twitter-logo' src={twitterLogo} />
          <a className='footer-text' href={TWITTER_LINK} target='_blank' rel='noreferrer'>{`built by @${TWITTER_HANDLE}`}</a>
        </div>
      </div>
    </div>
  );
};

export default App;

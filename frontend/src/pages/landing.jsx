import React from "react";
import { Link } from "react-router-dom";
import "../App.css";

function LandingPage() {
  console.log("Landing loaded");
  return (
    <div className='landingPageContainer'>
      <nav>
        <div className='navHeader'>
          <h2>AirMeet</h2>
        </div>
        <div className='navlist'>
          <p>Join as Guest</p>
          <p>Register</p>
        <div role='button'>
          <p>Login</p>
          </div>          
        </div>
      </nav>

    <div className="landingMainContainer">
      <div>
        <h1><span style={{color:"#6366F1"}}>Meet</span> Anyone. Anytime. Anywhere</h1>
       
       <p>Whether it's a quick chat or an important meeting, AirMeet has you covered.</p>
     <div role='button'>
      <Link to={"/auth"}>Get Started</Link>
     </div>
      </div>
      <div>
        <img src="/mobile.png" alt="" />
      </div>
    </div>

    </div>
  );
}

export default LandingPage;

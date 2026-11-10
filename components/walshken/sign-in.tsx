"use client";
import { useState, type FormEvent } from "react";
import { Brand, Icon } from "./brand";
import { api } from "./ui";

export function SignIn({ready,initial,preview=false}:{ready:boolean;initial:boolean;preview?:boolean}){
  const [mode,setMode]=useState(initial?"bootstrap":"login");
  const [error,setError]=useState(""),[pending,setPending]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setPending(true);setError("");
    try{
      await api(`session/${mode}`,Object.fromEntries(new FormData(event.currentTarget)));
      window.location.assign("/staff");
    }catch(e){setError(e instanceof Error?e.message:"Try again.");setPending(false);}
  }
  return <main className="auth-page">
    <div className="auth-side"><Brand/><div className="auth-story"><div className="section-kicker"><span/> WALSHKEN STAFF WORKSPACE</div>
      <h1>Your workday,<br/>in one place.</h1><p>Access your team, assignments, schedule and work records from one secure workspace.</p>
      <div className="auth-features"><span><Icon name="message" size={17}/> Team communication</span><span><Icon name="calendar" size={17}/> Shifts and attendance</span><span><Icon name="shield" size={17}/> Private staff access</span></div>
    </div><a href="/" className="text-link"><Icon name="left" size={16}/> Back to corporate website</a></div>
    <div className="auth-main"><div className="auth-shell">
      <span className="icon-tile"><Icon name="lock" size={23}/></span>
      <h2>{mode==="bootstrap"?"Set up Walshken":mode==="activate"?"Activate staff access":"Staff sign in"}</h2>
      <p>{!ready?"Staff access opens when the Walshken database is connected.":mode==="bootstrap"?"Create the first administrator using the configured work email and setup code.":mode==="activate"?"Use the one-time code from your administrator to set your password.":"Sign in with your Walshken work email."}</p>
      {preview&&<a href="/preview" className="btn btn-outline">Review staff and admin screens <Icon name="external" size={16}/></a>}
      {ready&&<form className="auth-form" onSubmit={submit} key={mode}>
        {mode==="bootstrap"&&<label>Full name<input name="name" required autoComplete="name" maxLength={100}/></label>}
        <label>Work email<input name="email" type="email" required autoComplete="username" maxLength={254} placeholder="you@walshken.com"/></label>
        {mode!=="login"&&<label>{mode==="bootstrap"?"Setup code":"Activation or reset code"}<input name="code" type="password" required maxLength={180} autoComplete="off"/></label>}
        <label>Password<input name="password" type="password" required minLength={mode==="login"?undefined:12} maxLength={160}
          autoComplete={mode==="login"?"current-password":"new-password"} placeholder={mode==="login"?"Enter password":"At least 12 characters"}/></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-blue" disabled={pending}>{pending?"Working…":mode==="bootstrap"?"Create administrator":mode==="activate"?"Activate account":"Sign in"}<Icon name="right" size={16}/></button>
      </form>}
      {ready&&!initial&&<button type="button" className="text-link auth-toggle" onClick={()=>{setMode(mode==="activate"?"login":"activate");setError("");}}>
        {mode==="activate"?"Back to sign in":"I have an activation or reset code"}<Icon name="right" size={14}/></button>}
    </div></div>
  </main>;
}

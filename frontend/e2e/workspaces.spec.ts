import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("akura-language","en"));
  await page.route(/^http:\/\/localhost:8000\//,async route=>{
    const url=new URL(route.request().url());
    await route.continue({url:`http://localhost:8001${url.pathname}${url.search}`});
  });
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:"ignoreErrors"})});

test("create rename reopen and separate workspace sources and history",async({page,request},info)=>{
  const title=`Biology ${info.project.name} ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button",{name:"Create workspace",exact:true}).click();
  await page.getByLabel("Workspace name",{exact:true}).fill(title);
  await page.getByLabel("Description (optional)").fill("My biology revision notes");
  await page.getByRole("button",{name:"Save workspace"}).click();
  await expect(page).toHaveURL(/\/workspaces\//);
  const workspaceId=new URL(page.url()).pathname.split("/")[2];
  await expect(page.locator(".study-heading")).toContainText(title);
  await page.getByRole("button",{name:"Rename",exact:true}).click();
  await page.getByLabel("Workspace name",{exact:true}).fill(title+" renamed");
  await page.getByRole("button",{name:"Save workspace"}).click();
  await expect(page.locator(".study-heading")).toContainText(title+" renamed");
  await page.reload();
  await expect(page.locator(".study-heading")).toContainText(title+" renamed");
  if(info.project.name==="mobile")await page.locator(".workspace-mobile-tabs").getByRole("button",{name:"Sources",exact:true}).click();
  await page.getByRole("link",{name:"Add files or notes"}).click();
  await page.getByRole("button",{name:"Paste text",exact:true}).click();
  await page.getByLabel("Title",{exact:true}).fill("Workspace biology note");
  await page.getByLabel("Note text",{exact:true}).fill("Photosynthesis uses sunlight to produce glucose in plants. Chlorophyll absorbs light energy. Roots absorb water and minerals from the soil.");
  await page.getByRole("button",{name:"Save note",exact:true}).click();
  await expect(page.locator(".document-card").filter({hasText:"Workspace biology note"}).getByText("Ready",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Back to chat",exact:true}).click();
  if(info.project.name==="mobile")await page.locator(".workspace-mobile-tabs").getByRole("button",{name:"Chat",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Your question",exact:true})).toBeDisabled();
  if(info.project.name==="mobile")await page.locator(".workspace-mobile-tabs").getByRole("button",{name:"Sources",exact:true}).click();
  await page.getByRole("checkbox",{name:"Workspace biology note",exact:true}).check();
  if(info.project.name==="mobile")await page.locator(".workspace-mobile-tabs").getByRole("button",{name:"Chat",exact:true}).click();
  await page.getByRole("textbox",{name:"Your question",exact:true}).fill("What absorbs light energy?");
  await page.getByRole("button",{name:"Send question",exact:true}).click();
  await expect(page.locator(".chat-exchange")).toContainText("Chlorophyll");
  await page.getByRole("link",{name:"All workspaces",exact:true}).click();
  await page.getByRole("textbox",{name:"Search workspaces",exact:true}).fill(title);
  await expect(page.locator(".workspace-card")).toHaveCount(1);
  await page.locator(".workspace-card-open").click();
  await expect(page.locator(".chat-exchange")).toContainText("What absorbs light energy?");
  const other=await (await request.post("http://localhost:8001/workspaces",{data:{name:"Separate workspace"}})).json();
  await page.goto(`/workspaces/${other.id}`);
  await expect(page.locator(".study-heading")).toContainText("Separate workspace");
  await expect(page.locator(".chat-exchange")).toHaveCount(0);
  const docs=await (await request.get(`http://localhost:8001/workspaces/${workspaceId}/documents`)).json();
  expect((await request.get(`http://localhost:8001/workspaces/${other.id}/documents/${docs[0].id}`)).status()).toBe(404);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`../.artifacts/qa/workspace-empty-${info.project.name}.png`,fullPage:true});
});

test("keyboard cancellation, invalid workspace and late history remain contained", async ({page,request})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Create workspace",exact:true}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Workspace name",{exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Workspace name",{exact:true})).toHaveCount(0);
  await page.goto("/workspaces/11111111-1111-1111-1111-111111111111");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("link",{name:"All workspaces",exact:true}).click();
  const a=await (await request.post("http://localhost:8001/workspaces",{data:{name:"Late history A"}})).json();
  const b=await (await request.post("http://localhost:8001/workspaces",{data:{name:"Current workspace B"}})).json();
  let started=false, finished=false;
  await page.route(`**/workspaces/${a.id}/chats`,async route=>{
    started=true;
    await new Promise(resolve=>setTimeout(resolve,500));
    // A full navigation cancels this request; the app also aborts it on unmount.
    await route.fulfill({contentType:"application/json",body:JSON.stringify([{id:"late-private",question:"PRIVATE A QUESTION",answer:"PRIVATE A ANSWER",sources:[],created_at:new Date().toISOString()}])});
    finished=true;
  });
  await page.goto(`/workspaces/${a.id}`);
  await expect.poll(()=>started).toBe(true);
  await page.goto(`/workspaces/${b.id}`);
  await expect(page.locator(".study-heading")).toContainText("Current workspace B");
  await expect(page.getByText("PRIVATE A ANSWER",{exact:true})).toHaveCount(0);
  await expect.poll(()=>finished).toBe(true);
  await expect(page.locator(".chat-exchange")).toHaveCount(0);
});

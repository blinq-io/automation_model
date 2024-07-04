import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
    beforeEach(async function () {
        context = await initContext("/", true, false);
        let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/"
        // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
        console.log(`Navigating to URL ${url}`)
        await context.stable.goto(url);
    });
    afterEach(async function () {
        console.log("Closing browser")
        await closeContext();
    });

    it("Click elements by Name", async function () {
        let nameLocElements = {
            //input fields
            first_name: {
                locators: [{ css: '[name="first_name"]' }]
            },
            last_name: {
                locators: [{ css: '[name="last_name"]' }]
            },
            email: {
                locators: [{ css: '[name="email"]' }],
            },
            phone: {
                locators: [{ css: '[name="phone"]' }],
            },
            passwordInput: {
                locators: [{ css: '[name="passwordInput"]' }],
            },
            numberInput: {
                locators: [{ css: '[name="numberInput"]' }],
            },
            urlInput: {
                locators: [{ css: '[name="urlInput"]' }],
            },
            searchInput: {
                locators: [{ css: '[name="searchInput"]' }],
            },
            dateInput: {
                locators: [{ css: '[name="dateInput"]' }],
            },
            timeInput: {
                locators: [{ css: '[name="timeInput"]' }],
            },
            colorInput: {
                locators: [{ css: '[name="colorInput"]' }],
            }, 
            checkboxInput: {
                locators: [{ css: '[name="checkboxInput"]' }],
            }, 
            radioInput: {
                locators: [{ css: '[name="radioInput"]' }],
            },
    
            //fieldSet. This fails as name should be unique for an element.
            // language: {
            //     locators: [{ css: '[name="language"]' }],
            // },
    
            //drodown-select
            country: {
                locators: [{ css: '[name="country"]' }],
            },
    
            //textarea
            message: {
                locators: [{ css: '[name="message"]' }],
            },
            experience: {
                locators: [{ css: '[name="experience"]' }],
            },
            // This fails, as hidden fields are not supported for click.
            // user_id: {
            //     locators: [{ css: '[name="user_id"]' }],
            // },
            submit: {
                locators: [{ css: '[name="submitButton"]' }],
            },
            reset: {
                locators: [{ css: '[name="resetButton"]' }],
            },
    
        };

        
        let info = null;
        for (let key in nameLocElements) {
            console.log(`Click "${key}" element using locator "${nameLocElements[key].locators[0].css}"`);
            info = await context.stable.click(nameLocElements[key]);
            console.log(info.log)
        }
    });

    it("Click elements by ID", async function () {
        let idLocElements = {
            //input fields
            first_name: {
                locators: [{ css: '#first_name' }]
            },
            last_name: {
                locators: [{ css: '#last_name' }]
            },
            email: {
                locators: [{ css: '#email' }],
            },
            phone: {
                locators: [{ css: '#phone' }],
            },
            passwordInput: {
                locators: [{ css: '#password' }],
            },
            numberInput: {
                locators: [{ css: '#number' }],
            },
            urlInput: {
                locators: [{ css: '#urlInput' }],
            },
            searchInput: {
                locators: [{ css: '#searchInput' }],
            },
            dateInput: {
                locators: [{ css: '#dateInput' }],
            },
            timeInput: {
                locators: [{ css: '#timeInput' }],
            },
            colorInput: {
                locators: [{ css: '#colorInput' }],
            }, 
            checkboxInput: {
                locators: [{ css: '#checkboxInput' }],
            }, 
            radioInput: {
                locators: [{ css: '#radioInput' }],
            },
    
            inputFrench: {
                locators: [{ css: '#french' }],
            },
            inputEnglish: {
                locators: [{ css: 'input#english' }],
            },
            inputSpanish: {
                locators: [{ css: 'input#spanish' }],
            },
    
            //drodown-select
            country: {
                locators: [{ css: '#country' }],
            },
    
            //textarea
            message: {
                locators: [{ css: '#message' }],
            },
            experience: {
                locators: [{ css: '#experience' }],
            },
            // This fails, as hidden fields are not supported for click.
            // user_id: {
            //     locators: [{ css: '#user_id' }],
            // },
            submit: {
                locators: [{ css: '#submit' }],
            },
            reset: {
                locators: [{ css: '#reset' }],
            },
    
        };

        
        let info = null;
        for (let key in idLocElements) {
            console.log(`Click "${key}" element using locator "${idLocElements[key].locators[0].css}"`);
            info = await context.stable.click(idLocElements[key]);
            console.log(info.log)
        }
    });

    it("Click elements by Class Name", async function () {
        let classLocElements = {
            h1Heading: {
                locators: [{ css: '.main-heading' }]
            },
            
            //input fields
            first_name: {
                locators: [{ css: '.fname' }]
            },
            last_name: {
                locators: [{ css: '.lname.new' }]
            },
            email: {
                locators: [{ css: '.ajs-3' }],
            },
            phone: {
                locators: [{ css: '.phoneno' }],
            },
            passwordInput: {
                locators: [{ css: '.passwordip' }],
            },
            numberInput: {
                locators: [{ css: '.numfield' }],
            },
            urlInput: {
                locators: [{ css: '.URL' }],
            },
            searchInput: {
                locators: [{ css: '.searchfield' }],
            },
            dateInput: {
                locators: [{ css: '.dateIp' }],
            },
            timeInput: {
                locators: [{ css: '.timeIP' }],
            },
            colorInput: {
                locators: [{ css: '.blue' }],
            },

            //This fails as result is plural. Move it to negative test later.
            // checkboxInput: {
            //     locators: [{ css: '.lg-43.sksd.fayed' }],
            // }, 

            // radioInput: {
            //     locators: [{ css: '.lg-43.sksd.fayed.new' }],
            // },

            experience: {
                locators: [{ css: '.lg-43.sksd.fayed.new.range' }],
            },
            inputFrench: {
                locators: [{ css: '.langEnglish' }],
            },
            inputEnglish: {
                locators: [{ css: '.langFr' }],
            },
            inputSpanish: {
                locators: [{ css: '.langSpanish' }],
            },
    
            //drodown-select
            country: {
                locators: [{ css: '.CountryField' }],
            },

            //drodown-select. This fails, use `select` method to select options. Move later
            // canadaOption: {
            //     locators: [{ css: '.canadaTest' }],
            // },
            
            //textarea
            message: {
                locators: [{ css: '.textArea.sm-lg' }],
            },
            submit: {
                locators: [{ css: '.abc' }],
            },
            reset: {
                locators: [{ css: '.resetAll' }],
            },
    
        };

        
        let info = null;
        for (let key in classLocElements) {
            console.log(`Click "${key}" element using locator "${classLocElements[key].locators[0].css}"`);
            info = await context.stable.click(classLocElements[key]);
            console.log(info.log)
        }
    });

});
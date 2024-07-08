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

    it("Click elements by Tag Name", async function () {
        let tagLocElements = {
            html: {
                locators: [{ css: 'html' }]
            },
            h1Heading: {
                locators: [{ css: 'h1' }]
            },
            h2Heading: {
                locators: [{ css: 'h2' }]
            },
            h3Heading: {
                locators: [{ css: 'h3' }]
            },
            h4Heading: {
                locators: [{ css: 'h4' }]
            },
            h5Heading: {
                locators: [{ css: 'h5' }]
            },
            h6Heading: {
                locators: [{ css: 'h6' }]
            },
            footer: {
                locators: [{ css: 'footer' }]
            },
            details: {
                locators: [{ css: 'details' }]
            },
            audio: {
                locators: [{ css: 'audio' }]
            },
            hr: {
                locators: [{ css: 'hr' }]
            },
            // video: {
            //     locators: [{ css: 'video' }]
            // },
            img: {
                locators: [{ css: 'img' }]
            },
            a: {
                locators: [{ css: 'a' }]
            },
            section: {
                locators: [{ css: 'section' }]
            },
            ul: {
                locators: [{ css: 'ul' }]
            },
            ol: {
                locators: [{ css: 'ol' }]
            },
            dl: {
                locators: [{ css: 'dl' }]
            },
            strong: {
                locators: [{ css: 'strong' }]
            },
            caption: {
                locators: [{ css: 'caption' }]
            },
            table: {
                locators: [{ css: 'table' }]
            },
            thead: {
                locators: [{ css: 'thead' }]
            },
            tbody: {
                locators: [{ css: 'tbody' }]
            },
            tfoot: {
                locators: [{ css: 'tfoot' }]
            }
        };

        let info = null;
        for (let key in tagLocElements) {
            console.log(`Click "${key}" element using locator "${tagLocElements[key].locators[0].css}"`);
            info = await context.stable.click(tagLocElements[key]);
            console.log(info.log)
        }
    });

    it("Click elements by XPath", async function () {
        let locElements = {
            a1: {
                locators: [{ css: '//a[text()="This is a link"]' }]
            },
            li1: {
                locators: [{ css: '//li[text()="Item 2"]' }]
            },
            h1: {
                locators: [{ css: "//h1[@class='main-heading']" }]
            },
            summary: {
                locators: [{ css: "//details/summary" }]
            },
            details: {
                locators: [{ css: "//details/p" }]
            },
            img: {
                locators: [{ css: "//img[@src='https://via.placeholder.com/150']" }]
            },
            a2: {
                locators: [{ css: '//a[contains(text(),"This")]' }]
            },
            li2: {
                locators: [{ css: '//li[contains(text(),"Item 2")]' }]
            },
            ol1: {
                locators: [{ css: "//ol/li[text()='First item']" }]
            },
            input_with_id: {
                locators: [{ css: "//input[@id='first_name']" }]
            },
            input_with_class: {
                locators: [{ css: "//input[@class='emailfield ajs-3']" }]
            },
            submit: {
                locators: [{ css: "//input[@type='submit' and @value='Submit']" }]
            },
            select: {
                locators: [{ css: "//select[@id='country']" }]
            },
            td_cell: {
                locators: [{ css: "//td[text()='Data 3']" }]
            },
            footer: {
                locators: [{ css: "//footer/p" }]
            },
            form: {
                locators: [{ css: "//form[@name='testForm']" }]
            },
        };

        let info = null;
        for (let key in locElements) {
            console.log(`Click "${key}" element using locator "${locElements[key].locators[0].css}"`);
            info = await context.stable.click(locElements[key]);
            console.log(info.log)
        }
    });

    it("Click elements by CSS Locators", async function () {
        let locElements = {
            h1: {
                locators: [{ css: 'h1.main-heading' }]
            },
            details: {
                locators: [{ css: 'details > summary' }]
            },
            details_p: {
                locators: [{ css: "details > p" }]
            },
            img_src: {
                locators: [{ css: "img[src='https://via.placeholder.com/150']" }]
            },
            a_href: {
                locators: [{ css: "a[href='#']" }]
            },
            //Ordered list item First item
            ol_first_item: {
                locators: [{ css: "ol > li:nth-of-type(1)" }]
            },
            input_with_class: {
                locators: [{ css: '.emailfield.ajs-3' }]
            },
            input_type_value: {
                locators: [{ css: "input[type='submit'][value='Submit']" }]
            },
            //Table cell containing text Data 3:
            table_cell: {
                locators: [{ css: "body > table > tbody > tr:nth-child(1) > td:nth-child(1)" }]
            },
            input_with_id: {
                locators: [{ css: "//input[@id='first_name']" }]
            },
            input_with_class: {
                locators: [{ css: "//input[@class='emailfield ajs-3']" }]
            },
            submit: {
                locators: [{ css: "//input[@type='submit' and @value='Submit']" }]
            },
            select: {
                locators: [{ css: "//select[@id='country']" }]
            },
            td_cell: {
                locators: [{ css: "//td[text()='Data 3']" }]
            }
        };

        let info = null;
        for (let key in locElements) {
            console.log(`Click "${key}" element using locator "${locElements[key].locators[0].css}"`);
            info = await context.stable.click(locElements[key]);
            console.log(info.log)
        }
    });

    it("Click elements by Role locators", async function () {
        let locElements = {
            button: {
                locators: [{ css: '//*[@role="submitButton"]' }]
            },
            heading: {
                locators: [{ css: '//h1[@role="heading"]' }]
            },
            details: {
                locators: [{ css: '//details[@role="group"]' }]
            },
            p: {
                locators: [{ css: '//*[@role="note"]' }]
            },
            audio: {
                locators: [{ css: '//*[@role="audio"]' }]
            },
            audio: {
                locators: [{ css: '//*[@role="audio"]' }]
            },
            section: {
                locators: [{ css: '//*[@role="region"]' }]
            },
            form: {
                locators: [{ css: '//form[@role="form"]' }]
            },
            resetButton: {
                locators: [{ css: "//input[@type='reset' and @role='button']" }]
            },
            td: {
                locators: [{ css: "//td[@role='cell']" }]
            },
            select: {
                locators: [{ css: "//select[@role='country']" }]
            }
            ,
            textarea: {
                locators: [{ css: "//*[@role='textarea']" }]
            },
            footer: {
                locators: [{ css: "//*[@role='footer']" }]
            }
        };

        let info = null;
        for (let key in locElements) {
            console.log(`Click "${key}" element using locator "${locElements[key].locators[0].css}"`);
            info = await context.stable.click(locElements[key]);
            console.log(info.log)
        }
    });


});
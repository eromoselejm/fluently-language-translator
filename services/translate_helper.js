import JsGoogleTranslateFree from "@kreisler/js-google-translate-free";

export const translate = async (statement, target, source="auto") => {

try {
	  const from = source;
    const to = target;
    const text = statement;
    const translation = await JsGoogleTranslateFree.translate({ from, to, text });
    return translation // Good morning
  } catch (error) {
    console.error(error);
  }

}
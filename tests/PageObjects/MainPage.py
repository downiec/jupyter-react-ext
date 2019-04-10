import time

from BasePage import BasePage
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.action_chains import ActionChains


class MainPage(BasePage):

    def __init__(self, driver, server):
        super(MainPage, self).__init__(driver, server)

    def _validate_page(self):
        # validate Main page is displaying a 'Home' tab
        logo_locator = 'jp-MainLogo'
        self.driver.find_element_by_id(logo_locator)

    def find_tab(self, tab_name):
        '''
        find the tab element ('File', 'Edit', 'View', 'Run'...) and
        return the element
        '''
        tabs_locator = "//ul[@class='p-MenuBar-content']/li"
        tabs_elements = self.driver.find_elements_by_xpath(tabs_locator)
        tab_label_locator = ".//div[@class='p-MenuBar-itemLabel']"
        for tab_element in tabs_elements:
            tab_label_element = tab_element.find_element_by_xpath(tab_label_locator)
            if tab_label_element.text == tab_name:
                return tab_label_element

    def find_menu_item_from_tab_drop_down_and_click(self, menu_item_name):
        '''
        find the specified menu item from the tab drop down, and
        click on it.
        '''
        menu_items_locator = "//ul[@class='p-Menu-content']/li"
        menu_items_elements = self.driver.find_elements_by_xpath(menu_items_locator)
        item_label_locator = "./div[@class='p-Menu-itemLabel']"
        index = 0
        for m in menu_items_elements:
            item_label_element = m.find_element_by_xpath(item_label_locator)
            if menu_item_name in item_label_element.text:
                break
            index += 1

        menu_item = menu_items_elements[index]
        print("Going to click on '{n}'".format(n=menu_item_name))
        action_chains = ActionChains(self.driver)
        action_chains.move_to_element(menu_item)
        time.sleep(self._delay)
        action_chains.click(menu_item).perform()
        time.sleep(self._delay * 2)

    def click_on_file_tab(self):
        print("...click on 'File' tab...")
        file_tab_element = self.find_tab('File')
        file_tab_element.click()
        time.sleep(self._delay)

    def select_kernel(self):
        """
        can call this method when you get the "Select Kernel" pop up
        """
        select_kernel_popup_locator = "//span[contains(text(), 'Select Kernel')]"
        kernel_select_button_locator = "//button//div[contains(text(), 'SELECT')]"

        print("...looking for the 'Select Kernel' pop up")
        time.sleep(self._delay)
        self.driver.find_element_by_xpath(select_kernel_popup_locator)

        print("...FOUND 'Select Kernel' pop up")
        time.sleep(self._delay)

        print("...click on SELECT button")
        self.find_element_and_click(kernel_select_button_locator, "Kernel Select button")
        time.sleep(self._delay)

    def shutdown_kernel(self):
        kernel_tab_locator = "//div[@class='p-MenuBar-itemLabel'][contains(text(), 'Kernel')]"
        kernel_tab_element = self.driver.find_element_by_xpath(kernel_tab_locator)
        shutdown_kernel_locator = "//li[@class='p-Menu-item'][@data-command='kernelmenu:shutdown']"
        print("FOUND 'Kernel' tab")
        if kernel_tab_element.is_displayed() and kernel_tab_element.is_enabled():
            kernel_tab_element.click()
            print("...check if need to shut down kernel...")
            try:
                shutdown_kernel_element = self.driver.find_element_by_xpath(shutdown_kernel_locator)
                if shutdown_kernel_element.is_displayed() and shutdown_kernel_element.is_enabled():
                    print("...shut down kernel...")
                    shutdown_kernel_element.click()
                    time.sleep(self._delay)
                else:
                    print("'Shutdown Kernel' is not clickable")
            except NoSuchElementException:
                print("No need to shutdown kernel")

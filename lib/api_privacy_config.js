'use strict'
const util = require('./util')
const postJSON = util.postJSON

/**
 * 查询小程序用户隐私保护指引
 * 详情请见：<https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/privacy_config/get_privacy_setting.html>
 * 请求地址
 * POST https://api.weixin.qq.com/cgi-bin/component/getprivacysetting?access_token=ACCESS_TOKEN
 * @param {Integer} privacyVer
 */
exports.getPrivacySetting = async function (privacyVer=2) {
    //const componentAccessToken = await this.ensureComponentToken()
    const token = await this.ensureAccessToken()
    const url = this.prefix + 'component/getprivacysetting?access_token=' + token.accessToken
    const data = {
        privacy_ver: privacyVer
    }

    return this.request(url, postJSON(data))
}

/**
 * 配置小程序用户隐私保护指引
 * 详情请见：<https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/privacy_config/set_privacy_setting.html>
 * 请求地址
 * POST https://api.weixin.qq.com/cgi-bin/component/setprivacysetting?access_token=ACCESS_TOKEN
 * @param {Integer} privacyVer
 * @param {Object} ownerSetting
 * @param {Object[]} settingList
 */
exports.setPrivacySetting = async function (ownerSetting, privacyVer, settingList) {
    //const componentAccessToken = await this.ensureComponentToken()
    const token = await this.ensureAccessToken()
    const url = this.prefix + 'component/setprivacysetting?access_token=' + token.accessToken
    const data = {
        owner_setting: ownerSetting,
        privacy_ver: privacyVer,
        setting_list: settingList
    }

    if(privacyVer == 1) {
        delete data.setting_list
    }
    else if(!settingList) {
        throw new Error(
            `settingList is required`
        )
    }

    return this.request(url, postJSON(data))
}
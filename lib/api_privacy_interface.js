'use strict'
const util = require('./util')
const postJSON = util.postJSON

/**
 * 获取隐私接口列表
 * 详情请见：<https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/apply_api/get_privacy_interface.html>
 * 请求地址
 * GET https://api.weixin.qq.com/wxa/security/get_privacy_interface?access_token=ACCESS_TOKEN
 *
 */
exports.getPrivacyInterface = async function () {
    //const componentAccessToken = await this.ensureComponentToken()
    const token = await this.ensureAccessToken()
    const url = this.wxappPrefix + 'security/get_privacy_interface?access_token=' + token.accessToken

    return this.request(url)
}

/**
 * 申请开通隐私接口
 * 详情请见：<https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/apply_api/apply_privacy_interface.html>
 * 请求地址
 * POST https://api.weixin.qq.com/wxa/security/apply_privacy_interface?access_token=ACCESS_TOKEN
 * @param {String} apiName
 * @param {String} content
 * @param {String[]} picList
 * @param {String[]} videoList
 * @param {String[]} urlList
 */
exports.applyPrivacyInterface = async function (apiName, content, picList, videoList, urlList) {
    //const componentAccessToken = await this.ensureComponentToken()
    const token = await this.ensureAccessToken()
    const url = this.wxappPrefix + 'security/apply_privacy_interface?access_token=' + token.accessToken
    const data = {
        api_name: apiName,
        content
    }

    if(picList) {
        data.pic_list = picList
    }

    if(videoList) {
        data.video_list = videoList
    }

    if(urlList) {
        data.url_list = urlList
    }

    return this.request(url, postJSON(data))
}
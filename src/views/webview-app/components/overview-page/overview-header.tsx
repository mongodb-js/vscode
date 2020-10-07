import * as React from 'react';
import { connect } from 'react-redux';
import { ActionTypes, LinkClickedAction } from '../../store/actions';

const styles = require('./overview-page.less');

type DispatchProps = {
  onLinkClicked: (screen: string, linkId: string) => void;
};

type props = DispatchProps;

class OverviewHeader extends React.Component<props> {
  onLinkClicked = (screen: string, linkId: string): void => {
    this.props.onLinkClicked(screen, linkId);
  };

  renderMongoLogo(): React.ReactNode {
    return (
      <svg width="188" height="50" viewBox="0 0 188 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.8734 19.8127C19.2661 8.31061 13.8318 5.24862 12.4456 3.08411C11.874 2.13059 11.3676 1.13945 10.9299 0.117493C10.8567 1.13929 10.7222 1.78302 9.85363 2.55789C8.10977 4.11272 0.703432 10.1481 0.080135 23.2169C-0.500587 35.4019 9.0379 42.9155 10.2981 43.6921C11.2671 44.1689 12.4473 43.7023 13.0229 43.2646C17.621 40.109 23.9034 31.6962 21.8785 19.8127" fill="#10AA50"/>
        <path d="M11.325 37.2037C11.0849 40.2197 10.9129 41.9721 10.3032 43.6955C10.3032 43.6955 10.7034 46.5668 10.9844 49.6083H11.979C12.2162 47.4665 12.5784 45.3404 13.0638 43.2408C11.7763 42.6073 11.3744 39.8501 11.325 37.2037Z" fill="#B8C4C2"/>
        <path d="M13.062 43.2425C11.7609 42.6413 11.3846 39.8263 11.3267 37.2037C11.6484 32.8775 11.7422 28.5373 11.6076 24.2013C11.5395 21.9261 11.64 3.12839 11.0474 0.376343C11.4528 1.30843 11.9199 2.21246 12.4455 3.08241C13.8318 5.24862 19.2677 8.31061 21.8733 19.8127C23.9033 31.6757 17.655 40.0664 13.062 43.2425Z" fill="#12924F"/>
        <path d="M184.554 39.0838C182.999 39.0836 181.736 37.8266 181.729 36.2714C181.722 34.7162 182.973 33.4477 184.528 33.4333C186.083 33.419 187.358 34.6643 187.379 36.2193C187.4 36.9783 187.11 37.7128 186.577 38.2534C186.044 38.7939 185.313 39.0938 184.554 39.0838ZM184.554 33.6887C183.513 33.6818 182.571 34.3032 182.167 35.2627C181.763 36.2222 181.978 37.3305 182.71 38.07C183.443 38.8095 184.549 39.0344 185.512 38.6395C186.476 38.2447 187.106 37.308 187.109 36.267C187.122 35.5833 186.858 34.9234 186.377 34.4376C185.895 33.9518 185.238 33.6816 184.554 33.6887ZM185.235 38.0449L184.506 36.4731H183.919V38.0449H183.491V34.4687H184.546C185.331 34.4687 185.658 34.8093 185.658 35.4683C185.658 35.9928 185.411 36.3198 184.951 36.4203L185.704 38.0398L185.235 38.0449ZM183.936 36.1035H184.554C185.055 36.1035 185.245 35.9332 185.245 35.4768C185.245 35.0204 185.063 34.8654 184.5 34.8654H183.936V36.1035Z" className={styles['overview-header-logo-path']}/>
        <path d="M142.505 36.5088C143.27 37.1202 144.797 37.3723 146.145 37.3723C147.89 37.3723 149.602 37.0487 151.274 35.5381C152.977 33.9901 154.149 31.6212 154.149 27.8389C154.149 24.2047 152.766 21.2551 149.929 19.5283C148.328 18.5218 146.253 18.125 143.888 18.125C143.207 18.125 142.505 18.1608 142.107 18.3413C141.943 18.4702 141.828 18.65 141.778 18.8522C141.707 19.4993 141.707 24.4278 141.707 27.3416C141.707 30.3287 141.707 34.4942 141.778 35.0051C141.815 35.4377 142.033 36.1972 142.505 36.5157V36.5088ZM135.244 16.5071C135.862 16.5071 138.212 16.6144 139.305 16.6144C141.349 16.6144 142.761 16.5071 146.58 16.5071C149.782 16.5071 152.476 17.3706 154.402 19.0242C156.732 21.0405 157.979 23.8454 157.979 27.2633C157.979 32.1202 155.765 34.9268 153.539 36.5088C151.325 38.1642 148.445 39.0991 144.343 39.0991C142.159 39.0991 138.411 39.0276 135.283 38.9918H135.218C135.072 38.704 135.485 37.5817 135.741 37.5528C136.592 37.4574 136.817 37.4234 137.209 37.2616C137.87 36.9908 138.025 36.6536 138.098 35.4666C138.207 33.2357 138.171 30.5739 138.171 27.5511C138.171 25.3934 138.207 21.1836 138.135 19.8518C138.025 18.7381 137.555 18.4503 136.603 18.234C135.928 18.0906 135.245 17.9826 134.559 17.9104C134.487 17.6941 135.046 16.7183 135.228 16.5071" className={styles['overview-header-logo-path']}/>
        <path d="M166.996 18.3328C166.851 18.3685 166.669 18.7296 166.669 18.9084C166.632 20.2044 166.596 23.5848 166.596 25.923C166.615 26.0144 166.687 26.0856 166.778 26.1035C167.25 26.1393 168.415 26.1768 169.397 26.1768C170.78 26.1768 171.581 25.9963 172.016 25.78C173.181 25.2044 173.719 23.9441 173.719 22.5783C173.719 19.4482 171.536 18.2612 168.299 18.2612C167.861 18.2557 167.424 18.2796 166.989 18.3328H166.996ZM175.249 32.7231C175.249 29.5572 172.919 27.7589 168.662 27.7589C168.481 27.7589 167.129 27.7231 166.807 27.7946C166.698 27.8304 166.589 27.9019 166.589 27.9751C166.589 30.2418 166.552 33.8743 166.662 35.3134C166.735 35.9247 167.173 36.7881 167.716 37.0402C168.299 37.3638 169.608 37.4353 170.518 37.4353C173.028 37.4353 175.249 36.0337 175.249 32.7231ZM160.422 16.5702C160.751 16.5702 161.718 16.6774 164.193 16.6774C166.521 16.6774 168.413 16.6059 170.664 16.6059C173.466 16.6059 177.321 17.6141 177.321 21.7864C177.321 23.83 175.867 25.4922 173.975 26.2841C173.866 26.3198 173.866 26.3913 173.975 26.4271C176.667 27.1083 179.031 28.7653 179.031 31.9312C179.031 35.0255 177.103 36.9687 174.302 38.1914C172.599 38.9475 170.482 39.1979 168.341 39.1979C166.705 39.1979 162.318 39.0276 159.879 39.0548C159.624 38.9475 160.113 37.7946 160.331 37.6158C160.889 37.5986 161.444 37.5117 161.981 37.3569C162.853 37.1424 162.957 36.8614 163.066 35.5654C163.139 34.4499 163.139 30.4564 163.139 27.6141C163.139 23.7279 163.176 21.1035 163.139 19.8076C163.103 18.8011 162.739 18.4758 162.047 18.297C161.502 18.188 160.593 18.0807 159.866 17.9734C159.683 17.7929 160.244 16.7132 160.424 16.5702" className={styles['overview-header-logo-path']}/>
        <path d="M29.9303 39.0838C29.8366 38.8535 29.7986 38.6043 29.8196 38.3566C29.8114 38.1877 29.8497 38.0199 29.9303 37.8712C30.4008 37.8034 30.8671 37.7084 31.3267 37.5868C31.9705 37.4268 32.2123 37.0759 32.2497 36.2551C32.3553 34.3154 32.3621 30.6761 32.3247 28.1182V28.0432C32.3247 27.7674 32.3247 27.3927 31.9841 27.1287C31.3854 26.7532 30.7355 26.4663 30.0546 26.2772C29.7497 26.187 29.5811 26.0269 29.5897 25.8396C29.5982 25.6522 29.7906 25.4308 30.1874 25.3525C31.2416 25.2452 34.0038 24.5862 35.0886 24.0855C35.2003 24.2311 35.2521 24.4138 35.2334 24.5964C35.2334 24.7088 35.2164 24.828 35.2044 24.9506C35.1738 25.3116 35.1397 25.7221 35.1397 26.1308C35.1533 26.2321 35.2231 26.3169 35.3199 26.3497C35.4167 26.3826 35.5237 26.3578 35.5961 26.2858C37.6619 24.6662 39.513 24.0889 40.4616 24.0889C42.0232 24.0889 43.2392 24.8348 44.1809 26.3709C44.2249 26.4463 44.3049 26.4934 44.3921 26.4952C44.4713 26.4945 44.5451 26.455 44.5897 26.3896C46.4885 24.9489 48.3703 24.0889 49.6305 24.0889C52.6074 24.0889 54.387 26.3181 54.387 30.0494C54.387 31.1223 54.3768 32.483 54.3666 33.7517C54.3581 34.8655 54.3495 35.9094 54.3495 36.6315C54.3495 36.8018 54.5846 37.2922 54.9371 37.3893C55.373 37.6022 56.0014 37.7112 56.7967 37.8474H56.8274C56.887 38.062 56.761 38.8947 56.6401 39.065C56.4425 39.065 56.17 39.048 55.8294 39.031C55.2113 39.0003 54.3632 38.9578 53.3771 38.9578C51.3982 38.9578 50.3645 38.9952 49.3768 39.0599C49.3019 38.813 49.2763 38.016 49.3666 37.8491C49.7756 37.7851 50.1805 37.697 50.5791 37.5851C51.2092 37.3774 51.3914 37.0913 51.4306 36.2551C51.4459 35.6608 51.56 30.424 51.3574 29.1808C51.17 27.8917 50.1993 26.3828 48.0757 26.3828C47.2872 26.3828 46.0151 26.7115 44.8025 27.6311C44.7273 27.7164 44.685 27.8257 44.6833 27.9394V27.9649C44.8264 28.6359 44.8264 29.4193 44.8264 30.6029C44.8264 31.284 44.8264 31.9942 44.8179 32.7043C44.8093 34.1485 44.8025 35.5109 44.8264 36.5412C44.8264 37.2428 45.2504 37.4114 45.5927 37.546C45.7784 37.5868 45.9248 37.6226 46.073 37.6567C46.3574 37.7265 46.6537 37.798 47.0948 37.8678C47.1601 38.167 47.1542 38.4773 47.0777 38.7738C47.0597 38.8851 47.016 38.9906 46.95 39.0821C45.8499 39.0446 44.7208 39.0123 43.091 39.0123C42.5972 39.0123 41.7916 39.0327 41.0798 39.0514C40.5025 39.0667 39.9575 39.0821 39.6476 39.0838C39.5637 38.886 39.5265 38.6716 39.5386 38.4571C39.5212 38.255 39.5607 38.052 39.6527 37.8712L40.0903 37.7912C40.4718 37.7231 40.8022 37.6652 41.1121 37.5868C41.6503 37.4165 41.8529 37.1236 41.8921 36.4373C41.9977 34.8365 42.0794 30.2231 41.8529 29.0685C41.4681 27.2156 40.4139 26.2755 38.7177 26.2755C37.7249 26.2755 36.4698 26.7541 35.4446 27.5221C35.2452 27.7162 35.1359 27.9848 35.1431 28.2629C35.1431 28.813 35.1431 29.467 35.1431 30.1686C35.1431 32.4847 35.1278 35.3678 35.184 36.6144C35.2181 36.9993 35.3543 37.4557 36.0747 37.6226C36.2331 37.6686 36.5055 37.7129 36.8223 37.7657C37.0045 37.7963 37.2038 37.8287 37.4098 37.8661C37.4753 38.2739 37.442 38.6915 37.3128 39.0838C36.996 39.0838 36.606 39.0633 36.1598 39.0446C35.4786 39.014 34.6271 38.9765 33.6649 38.9765C32.5273 38.9765 31.7354 39.014 31.1002 39.0446C30.6728 39.065 30.3032 39.0821 29.9337 39.0838" className={styles['overview-header-logo-path']}/>
        <path d="M66.4513 25.6284C65.8367 25.6156 65.2321 25.7857 64.7143 26.1171C63.4506 26.8852 62.8069 28.4196 62.8069 30.6744C62.8069 34.8944 64.9203 37.8423 67.9465 37.8423C68.758 37.868 69.5494 37.5878 70.1639 37.0572C71.0937 36.2994 71.5876 34.7496 71.5876 32.58C71.5876 28.423 69.5218 25.6284 66.4479 25.6284H66.4513ZM67.0303 39.4073C61.5637 39.4073 59.6172 35.3968 59.6172 31.6451C59.6172 29.0242 60.6884 26.9755 62.8018 25.5534C64.2821 24.6371 65.9812 24.1348 67.7218 24.0991C71.8924 24.0991 74.8062 27.0981 74.8062 31.3947C74.8062 34.3137 73.6431 36.6195 71.4411 38.0603C70.3835 38.7074 68.546 39.4073 67.0303 39.4073Z" className={styles['overview-header-logo-path']}/>
        <path d="M122.105 25.6284C121.489 25.6144 120.883 25.7846 120.364 26.1171C119.101 26.8852 118.457 28.4196 118.457 30.6744C118.457 34.8944 120.57 37.8423 123.597 37.8423C124.41 37.8697 125.205 37.5894 125.821 37.0572C126.751 36.2994 127.243 34.7496 127.243 32.58C127.243 28.423 125.179 25.6284 122.105 25.6284ZM122.687 39.4073C117.221 39.4073 115.274 35.3968 115.274 31.6468C115.274 29.0225 116.345 26.9755 118.46 25.5534C119.94 24.6365 121.639 24.1342 123.379 24.0991C127.549 24.0991 130.463 27.0998 130.463 31.393C130.463 34.3154 129.3 36.6195 127.098 38.0586C126.041 38.7074 124.203 39.4073 122.687 39.4073Z" className={styles['overview-header-logo-path']}/>
        <path d="M103.699 25.4853C102.015 25.4853 100.925 26.8154 100.925 28.8743C100.925 30.9332 101.863 33.3804 104.501 33.3804C104.954 33.3804 105.775 33.1795 106.182 32.7316C106.795 32.1679 107.204 31.0031 107.204 29.7735C107.204 27.0879 105.896 25.4853 103.707 25.4853H103.699ZM103.489 39.6952C103.014 39.69 102.544 39.8073 102.127 40.0358C100.794 40.8872 100.175 41.7387 100.175 42.7282C100.175 43.6546 100.535 44.392 101.308 45.046C102.245 45.8396 103.508 46.2261 105.169 46.2261C108.437 46.2261 109.901 44.4687 109.901 42.7282C109.901 41.5157 109.293 40.7033 108.042 40.2435C107.078 39.891 105.467 39.6969 103.495 39.6969L103.489 39.6952ZM103.713 48.0415C101.751 48.0415 100.337 47.6277 99.1298 46.6979C97.9547 45.7919 97.4268 44.4465 97.4268 43.5167C97.4395 42.9175 97.6681 42.343 98.0705 41.8988C98.4111 41.5105 99.203 40.7834 101.034 39.5249C101.092 39.5002 101.129 39.4431 101.129 39.3801C101.13 39.3092 101.082 39.247 101.013 39.2302C99.5061 38.6529 99.0514 37.6975 98.9135 37.1866C98.9135 37.1679 98.9135 37.139 98.8981 37.1066C98.8556 36.9056 98.8147 36.7149 99.0889 36.5191C99.3001 36.3692 99.6372 36.1682 99.9983 35.9554C100.508 35.6733 100.997 35.3551 101.461 35.0034C101.512 34.949 101.534 34.8743 101.522 34.801C101.51 34.7278 101.465 34.6641 101.4 34.6287C99.1689 33.8794 98.0449 32.2224 98.0449 29.69C98.0311 28.0874 98.8003 26.5788 100.106 25.6488C101.003 24.9387 103.256 24.0855 104.716 24.0855H104.801C106.301 24.1212 107.147 24.4363 108.319 24.8689C108.986 25.1099 109.692 25.222 110.4 25.1992C111.642 25.1992 112.185 24.8058 112.652 24.3477C112.727 24.5541 112.768 24.7717 112.771 24.9915C112.799 25.5151 112.657 26.0338 112.365 26.4697C112.112 26.8222 111.514 27.0776 110.967 27.0776C110.911 27.0776 110.857 27.0776 110.797 27.0691C110.509 27.0489 110.224 27.0016 109.945 26.9278L109.806 26.9772C109.762 27.0419 109.791 27.1134 109.826 27.2054C109.835 27.2233 109.842 27.2422 109.847 27.2616C109.946 27.7161 110.014 28.177 110.049 28.641C110.049 31.2892 109.005 32.4421 107.876 33.297C106.785 34.1161 105.488 34.6181 104.13 34.7479C104.101 34.7479 103.959 34.7599 103.694 34.7837C103.523 34.799 103.302 34.8195 103.27 34.8195H103.237C102.992 34.8876 102.352 35.1924 102.352 35.7595C102.352 36.2296 102.641 36.8137 104.026 36.9193L104.922 36.9823C106.747 37.11 109.028 37.2684 110.1 37.6311C111.56 38.1444 112.526 39.536 112.497 41.0831C112.497 43.4588 110.807 45.6931 107.979 47.0589C106.645 47.6961 105.184 48.0238 103.706 48.0177" className={styles['overview-header-logo-path']}/>
        <path d="M95.3441 37.8167C94.5437 37.7095 93.9595 37.6005 93.2698 37.2769C93.1345 37.1367 93.0453 36.9584 93.0144 36.766C92.9411 35.6505 92.9411 32.4131 92.9411 30.2946C92.9411 28.5661 92.6516 27.0589 91.9193 25.9775C91.0457 24.7531 89.8093 24.0344 88.2085 24.0344C86.7899 24.0344 84.8979 25.0051 83.3345 26.3368C83.2971 26.3726 83.0569 26.6008 83.0621 26.2466C83.0672 25.8924 83.1217 25.1737 83.1557 24.7139C83.1864 24.4662 83.098 24.2186 82.9173 24.0463C81.8955 24.5572 79.0294 25.2384 77.9684 25.3423C77.1952 25.4922 76.9994 26.2364 77.8253 26.4935H77.8373C78.4984 26.6758 79.1295 26.9535 79.7106 27.3178C80.0375 27.5698 80.0018 27.9291 80.0018 28.217C80.0375 30.6267 80.0375 34.3324 79.9285 36.3471C79.8928 37.139 79.6731 37.4268 79.0907 37.5715L79.1452 37.5528C78.7016 37.6639 78.2518 37.7481 77.7981 37.8048C77.6159 37.9836 77.6159 39.0276 77.7981 39.2439C78.1625 39.2439 80.012 39.1366 81.5447 39.1366C83.653 39.1366 84.7446 39.2439 85.2913 39.2439C85.511 38.9918 85.5825 38.0211 85.4377 37.8048C84.934 37.782 84.4337 37.7096 83.9442 37.5885C83.3635 37.4455 83.217 37.156 83.1813 36.5106C83.1097 34.8178 83.1097 31.221 83.1097 28.7738C83.1097 28.0926 83.2903 27.7674 83.5082 27.5817C84.2354 26.9346 85.4377 26.5037 86.4919 26.5037C87.5137 26.5037 88.1949 26.8273 88.7058 27.2582C89.3009 27.7774 89.6739 28.5053 89.748 29.2915C89.8928 30.6539 89.8553 33.3941 89.8553 35.7629C89.8553 37.0589 89.748 37.3842 89.2746 37.5272C89.0566 37.6345 88.4742 37.7435 87.7828 37.815C87.5648 38.0313 87.6363 39.0378 87.7828 39.2541C88.7279 39.2541 89.8264 39.1468 91.4204 39.1468C93.4214 39.1468 94.6952 39.2541 95.2044 39.2541C95.4224 39.002 95.4956 38.062 95.3509 37.815" className={styles['overview-header-logo-path']}/>
      </svg>
    );
  }

  render(): React.ReactNode {
    return (
      <div className={styles['overview-header']}>
        {this.renderMongoLogo()}
        <div className={styles['overview-header-description']}>
          Navigate your databases and collections, use playgrounds for exploring and transforming your data
        </div>
        <div className={styles['overview-header-bar']}/>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchProps = {
  onLinkClicked: (screen, linkId): LinkClickedAction => ({
    type: ActionTypes.EXTENSION_LINK_CLICKED,
    screen,
    linkId
  })
};

export default connect(() => ({}), mapDispatchToProps)(OverviewHeader);
